using Microsoft.Extensions.Logging;

namespace AspireApp1.Server.xUnit.TestDoubles;

/// <summary>A logger that records every entry so tests can assert on what was logged.</summary>
public sealed class TestLogger<T> : ILogger<T>
{
    public List<LogEntry> Entries { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
        => Entries.Add(new LogEntry(logLevel, formatter(state, exception), exception));
}

public sealed record LogEntry(LogLevel Level, string Message, Exception? Exception);
