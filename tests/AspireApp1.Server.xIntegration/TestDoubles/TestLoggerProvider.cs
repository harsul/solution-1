using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace AspireApp1.Server.xIntegration.TestDoubles;

/// <summary>Captures log entries from every logger in the app so tests can assert on them.</summary>
public sealed class TestLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<LogEntry> _entries = new();

    public IReadOnlyCollection<LogEntry> Entries => _entries;

    public ILogger CreateLogger(string categoryName) => new TestLogger(categoryName, _entries);

    public void Dispose()
    {
    }

    private sealed class TestLogger(string category, ConcurrentQueue<LogEntry> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
            => entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception), exception));
    }
}

public sealed record LogEntry(string Category, LogLevel Level, string Message, Exception? Exception);
