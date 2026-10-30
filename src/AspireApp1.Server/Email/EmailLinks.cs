using Microsoft.AspNetCore.WebUtilities;

namespace AspireApp1.Server.Email;

/// <summary>Builds links into the frontend from the configured public URL (never from request headers).</summary>
internal static class EmailLinks
{
    /// <summary>True for an absolute http(s) URL such as <c>https://example.com</c> or <c>https://example.com/app/</c>.</summary>
    public static bool IsValidPublicUrl(string? publicUrl) =>
        Uri.TryCreate(publicUrl, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
        && !string.IsNullOrEmpty(uri.Host);

    public static string ConfirmEmail(string publicUrl, string userId, string code) =>
        Build(publicUrl, "confirm-email", new() { ["userId"] = userId, ["code"] = code });

    public static string ResetPassword(string publicUrl, string email, string code) =>
        Build(publicUrl, "reset-password", new() { ["email"] = email, ["code"] = code });

    /// <summary>Appends <paramref name="path"/> to the public URL, keeping any path it already has.</summary>
    private static string Build(string publicUrl, string path, Dictionary<string, string?> query) =>
        QueryHelpers.AddQueryString($"{publicUrl.TrimEnd('/')}/{path}", query);
}
