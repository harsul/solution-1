using System.Text;
using Microsoft.AspNetCore.Identity;

namespace AspireApp1.Server.Auth;

/// <summary>Requires at least one letter in a password; Identity has no built-in option for this.</summary>
internal sealed class RequireLetterPasswordValidator : IPasswordValidator<IdentityUser>
{
    public const string ErrorCode = "PasswordRequiresLetter";

    public Task<IdentityResult> ValidateAsync(UserManager<IdentityUser> manager, IdentityUser user, string? password)
    {
        // Check whole Unicode characters (runes), like the frontend's /\p{L}/u, so letters outside
        // the Basic Multilingual Plane (e.g. 𝐀) count on both sides.
        var result = password is not null && password.EnumerateRunes().Any(Rune.IsLetter)
            ? IdentityResult.Success
            : IdentityResult.Failed(new IdentityError
            {
                Code = ErrorCode,
                Description = "Passwords must have at least one letter.",
            });

        return Task.FromResult(result);
    }
}
