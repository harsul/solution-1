namespace AspireApp1.Server.Email;

/// <summary>An email with a plain-text and an HTML version of the same content.</summary>
public sealed record EmailMessage(string To, string Subject, string TextBody, string HtmlBody);
