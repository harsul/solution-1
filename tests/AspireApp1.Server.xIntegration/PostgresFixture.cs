using System.Collections.Concurrent;
using System.Diagnostics;
using Npgsql;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(AspireApp1.Server.xIntegration.PostgresFixture))]

namespace AspireApp1.Server.xIntegration;

/// <summary>
/// One PostgreSQL server for the whole test run; every <see cref="ServerFactory"/> gets its own
/// fresh database on it (EF Core migrations create it at startup).
/// </summary>
/// <remarks>
/// The server comes from Testcontainers (needs Docker). To use an existing server instead,
/// e.g. in CI without Docker, set <c>TEST_POSTGRES_CONNECTION</c>.
/// Starting a single container avoids parallel test classes racing to start Testcontainers'
/// resource reaper, and waiting for a real connection from the host avoids Docker setups
/// (e.g. Rancher Desktop on WSL) where the published port works a moment after the container
/// reports ready.
/// </remarks>
public sealed class PostgresFixture : IAsyncLifetime
{
    private const string ExternalConnectionVariable = "TEST_POSTGRES_CONNECTION";
    private static readonly TimeSpan ReachableTimeout = TimeSpan.FromSeconds(60);

    private readonly ConcurrentBag<string> _databases = [];
    private PostgreSqlContainer? _container;
    private string _serverConnectionString = "";

    public async ValueTask InitializeAsync()
    {
        var external = Environment.GetEnvironmentVariable(ExternalConnectionVariable);
        if (!string.IsNullOrWhiteSpace(external))
        {
            _serverConnectionString = external;
        }
        else
        {
            _container = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _container.StartAsync();
            _serverConnectionString = _container.GetConnectionString();
        }

        await WaitUntilReachableAsync(_serverConnectionString);
    }

    public async ValueTask DisposeAsync()
    {
        if (_container is not null)
        {
            // The databases go away with the container.
            await _container.DisposeAsync();
            return;
        }

        // External server: remove the databases this run created.
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        foreach (var database in _databases)
        {
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    /// <summary>Connection string for a new, not yet existing database on the shared server.</summary>
    public string NewDatabaseConnectionString()
    {
        var database = $"test_{Guid.NewGuid():N}";
        _databases.Add(database);
        return new NpgsqlConnectionStringBuilder(_serverConnectionString) { Database = database }.ConnectionString;
    }

    private static async Task WaitUntilReachableAsync(string connectionString)
    {
        var stopwatch = Stopwatch.StartNew();
        while (true)
        {
            try
            {
                await using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();
                await using var command = new NpgsqlCommand("SELECT 1", connection);
                await command.ExecuteScalarAsync();
                return;
            }
            catch (Exception ex) when (ex is NpgsqlException or IOException && stopwatch.Elapsed < ReachableTimeout)
            {
                NpgsqlConnection.ClearAllPools();
                await Task.Delay(TimeSpan.FromMilliseconds(500));
            }
        }
    }
}
