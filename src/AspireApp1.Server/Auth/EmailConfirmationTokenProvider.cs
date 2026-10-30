using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace AspireApp1.Server.Auth;

/// <summary>
/// Token provider just for email confirmation, so its links can live longer (24 h) than password
/// reset links, which use Identity's default provider.
/// </summary>
internal sealed class EmailConfirmationTokenProvider(
    IDataProtectionProvider dataProtectionProvider,
    IOptions<EmailConfirmationTokenProviderOptions> options,
    ILogger<DataProtectorTokenProvider<IdentityUser>> logger)
    : DataProtectorTokenProvider<IdentityUser>(dataProtectionProvider, options, logger)
{
    public const string ProviderName = "EmailConfirmation";
}

internal sealed class EmailConfirmationTokenProviderOptions : DataProtectionTokenProviderOptions
{
    public EmailConfirmationTokenProviderOptions()
    {
        Name = "EmailConfirmationDataProtectorTokenProvider";
        TokenLifespan = TimeSpan.FromHours(24);
    }
}
