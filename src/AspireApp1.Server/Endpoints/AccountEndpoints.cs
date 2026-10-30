using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text;
using AspireApp1.Server.Email;
using AspireApp1.Server.Email.Messages;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace AspireApp1.Server.Endpoints;

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public sealed record DeleteAccountRequest(string? Password, string? Email);

public sealed record ChangeEmailRequest(string? NewEmail, string? Password);

public sealed record ConfirmEmailChangeRequest(string? UserId, string? Email, string? Code);

internal static class AccountEndpoints
{
    /// <summary>
    /// The signed-in user's own account (F4). Passwords are checked with lockout counting, so these
    /// endpoints can't be used to guess the password. Expected failures are 400s keyed by code.
    /// </summary>
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var account = app.MapGroup("/api/account").WithTags("Account").RequireAuthorization();

        account.MapPost("/password", ChangePasswordAsync);
        account.MapPost("/sign-out-others", SignOutOthersAsync);
        account.MapPost("/delete", DeleteAsync);
        account.MapPost("/email", RequestEmailChangeAsync);
        // The link may be opened in any browser, signed in or not.
        account.MapPost("/email/confirm", ConfirmEmailChangeAsync).AllowAnonymous();

        return app;
    }

    private static async Task<Results<NoContent, ValidationProblem, UnauthorizedHttpResult>> ChangePasswordAsync(
        ChangePasswordRequest request,
        ClaimsPrincipal principal,
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IEmailDelivery delivery,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(principal);
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        if (await VerifyPasswordAsync(signInManager, user, request.CurrentPassword) is { } failure)
        {
            return failure;
        }

        // Changing the password changes the security stamp, which ends every session ...
        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword!, request.NewPassword ?? "");
        if (!result.Succeeded)
        {
            return TypedResults.ValidationProblem(result.Errors
                .GroupBy(e => e.Code)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
        }

        // ... so give this browser a fresh cookie (it keeps its Remember me choice).
        await signInManager.RefreshSignInAsync(user);

        await NotifyAsync(userManager, user, delivery, loggers,
            to => PasswordChangedMessage.Create(to, time.GetUtcNow()), cancellationToken);

        return TypedResults.NoContent();
    }

    /// <summary>Ends every other session: a new security stamp invalidates all cookies, then this one is re-issued.</summary>
    private static async Task<Results<NoContent, UnauthorizedHttpResult>> SignOutOthersAsync(
        ClaimsPrincipal principal,
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager)
    {
        var user = await userManager.GetUserAsync(principal);
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        // Never report success for a security action that didn't happen (e.g. a concurrent update):
        // the global handler turns this into a logged 500.
        var result = await userManager.UpdateSecurityStampAsync(user);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Updating the security stamp failed: {string.Join(", ", result.Errors.Select(e => e.Code))}");
        }

        await signInManager.RefreshSignInAsync(user);

        return TypedResults.NoContent();
    }

    /// <summary>Deletes the account for good after the password and the typed email match; signs out.</summary>
    private static async Task<Results<NoContent, ValidationProblem, UnauthorizedHttpResult>> DeleteAsync(
        DeleteAccountRequest request,
        ClaimsPrincipal principal,
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IEmailDelivery delivery,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(principal);
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        if (await VerifyPasswordAsync(signInManager, user, request.Password) is { } failure)
        {
            return failure;
        }

        var email = await userManager.GetEmailAsync(user);
        if (email is null || !string.Equals(request.Email?.Trim(), email, StringComparison.OrdinalIgnoreCase))
        {
            return Problem("EmailMismatch", "The email address doesn't match this account.");
        }

        var notifyTo = await userManager.IsEmailConfirmedAsync(user) ? email : null;

        // Identity's own rows (logins, claims, tokens, ...) cascade with the user.
        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Deleting the account failed: {string.Join(", ", result.Errors.Select(e => e.Code))}");
        }

        await signInManager.SignOutAsync();

        if (notifyTo is not null)
        {
            await SendAsync(delivery, loggers, AccountDeletedMessage.Create(notifyTo), user.Id, cancellationToken);
        }

        return TypedResults.NoContent();
    }

    /// <summary>Emails a link to the new address (F5); nothing changes until it is opened.</summary>
    private static async Task<Results<NoContent, ValidationProblem, UnauthorizedHttpResult>> RequestEmailChangeAsync(
        ChangeEmailRequest request,
        ClaimsPrincipal principal,
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IEmailDelivery delivery,
        IOptions<EmailOptions> options,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(principal);
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        // The password comes first, so nothing about other accounts is revealed without it.
        if (await VerifyPasswordAsync(signInManager, user, request.Password) is { } failure)
        {
            return failure;
        }

        var newEmail = request.NewEmail?.Trim();
        if (string.IsNullOrEmpty(newEmail) || !new EmailAddressAttribute().IsValid(newEmail))
        {
            return Problem("InvalidEmail", "Enter a valid email address.");
        }

        // The address becomes the sign-in name, so it must also pass Identity's user name rules
        // (e.g. no apostrophes or accented letters); otherwise the change would fail at confirm.
        var allowed = userManager.Options.User.AllowedUserNameCharacters;
        if (!string.IsNullOrEmpty(allowed) && newEmail.Any(c => !allowed.Contains(c)))
        {
            return Problem("InvalidEmail", "This email address can't be used to sign in.");
        }

        if (string.Equals(newEmail, await userManager.GetEmailAsync(user), StringComparison.OrdinalIgnoreCase))
        {
            return Problem("SameEmail", "This is already your email address.");
        }

        if (await userManager.FindByEmailAsync(newEmail) is not null)
        {
            return Problem("DuplicateEmail", "This email address is already in use.");
        }

        var token = await userManager.GenerateChangeEmailTokenAsync(user, newEmail);
        var link = EmailLinks.ConfirmEmailChange(
            options.Value.PublicUrl, await userManager.GetUserIdAsync(user), newEmail, Encode(token));
        await SendAsync(delivery, loggers, ChangeEmailMessage.Create(newEmail, link), user.Id, cancellationToken);

        return TypedResults.NoContent();
    }

    /// <summary>
    /// Applies a change-email link (F5): the email changes and counts as confirmed, the sign-in name
    /// follows it, every session ends except this browser's (if it is the same user), and the old
    /// confirmed address is told.
    /// </summary>
    private static async Task<Results<NoContent, ValidationProblem>> ConfirmEmailChangeAsync(
        ConfirmEmailChangeRequest request,
        ClaimsPrincipal principal,
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IEmailDelivery delivery,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var invalid = Problem("InvalidToken", "This link is no longer valid.");
        var newEmail = request.Email?.Trim();
        if (string.IsNullOrEmpty(request.UserId) || string.IsNullOrEmpty(newEmail) || string.IsNullOrEmpty(request.Code)
            || Decode(request.Code) is not { } token)
        {
            return invalid;
        }

        var user = await userManager.FindByIdAsync(request.UserId);
        if (user is null)
        {
            return invalid;
        }

        var oldEmail = await userManager.GetEmailAsync(user);
        var notifyOld = oldEmail is not null && await userManager.IsEmailConfirmedAsync(user);

        // Usernames are email addresses: rename in memory so ChangeEmailAsync saves both in one update.
        user.UserName = newEmail;
        await userManager.UpdateNormalizedUserNameAsync(user);

        // Checks the token first (expired, used, tampered → InvalidToken), then validates the user
        // (address taken meanwhile → DuplicateEmail), sets and confirms the email, changes the security
        // stamp (ending every session) and saves once. On failure nothing is saved, and nothing about
        // other accounts is revealed without a valid token.
        var changed = await userManager.ChangeEmailAsync(user, newEmail, token);
        if (!changed.Succeeded)
        {
            return TypedResults.ValidationProblem(changed.Errors
                .GroupBy(e => e.Code)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
        }

        if (userManager.GetUserId(principal) == user.Id)
        {
            await signInManager.RefreshSignInAsync(user);
        }

        if (notifyOld)
        {
            await SendAsync(delivery, loggers, EmailChangedMessage.Create(oldEmail!, newEmail), user.Id, cancellationToken);
        }

        return TypedResults.NoContent();
    }

    private static string? Decode(string code)
    {
        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
        }
        catch (FormatException)
        {
            return null;
        }
    }

    /// <summary>Same encoding as Identity's built-in endpoints (Base64Url of the UTF-8 token).</summary>
    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    /// <summary>Checks the password and counts a wrong one towards the lockout; null when it is correct.</summary>
    private static async Task<ValidationProblem?> VerifyPasswordAsync(
        SignInManager<IdentityUser> signInManager, IdentityUser user, string? password)
    {
        var check = await signInManager.CheckPasswordSignInAsync(user, password ?? "", lockoutOnFailure: true);
        if (check.Succeeded)
        {
            return null;
        }

        return check.IsLockedOut
            ? Problem("LockedOut", "Account locked.")
            : Problem("PasswordMismatch", "Incorrect password.");
    }

    private static ValidationProblem Problem(string code, string description) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { [code] = [description] });

    /// <summary>Notifies confirmed addresses only (an unconfirmed one may be a typo). Failures are logged.</summary>
    private static async Task NotifyAsync(
        UserManager<IdentityUser> userManager,
        IdentityUser user,
        IEmailDelivery delivery,
        ILoggerFactory loggers,
        Func<string, EmailMessage> createMessage,
        CancellationToken cancellationToken)
    {
        var email = await userManager.GetEmailAsync(user);
        if (email is null || !await userManager.IsEmailConfirmedAsync(user))
        {
            return;
        }

        await SendAsync(delivery, loggers, createMessage(email), user.Id, cancellationToken);
    }

    /// <summary>Sends a notification; a failure is logged and never fails the request.</summary>
    private static async Task SendAsync(
        IEmailDelivery delivery, ILoggerFactory loggers, EmailMessage message, string userId, CancellationToken cancellationToken)
    {
        try
        {
            await delivery.SendAsync(message, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            loggers.CreateLogger(typeof(AccountEndpoints)).LogError(ex, "Sending the account notification failed for user {UserId}", userId);
        }
    }
}
