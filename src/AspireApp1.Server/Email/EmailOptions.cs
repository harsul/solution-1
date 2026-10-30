using System.ComponentModel.DataAnnotations;

namespace AspireApp1.Server.Email;

/// <summary>
/// Where links in emails point to (the frontend) and who sends the emails.
/// <see cref="PublicUrl"/> comes from <c>App:PublicUrl</c>: set by the AppHost in development,
/// configured explicitly when published. Never derived from request headers.
/// </summary>
public sealed class EmailOptions
{
    /// <summary>Validated on start by <see cref="EmailLinks.IsValidPublicUrl"/> (see EmailSetup).</summary>
    public string PublicUrl { get; set; } = "";

    [Required, EmailAddress]
    public string FromAddress { get; set; } = "no-reply@aspireapp1.local";

    [Required]
    public string FromName { get; set; } = "Aspire Starter";
}
