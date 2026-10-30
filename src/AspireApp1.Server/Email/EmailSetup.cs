using Microsoft.AspNetCore.Identity;

namespace AspireApp1.Server.Email;

internal static class EmailSetup
{
    public static IHostApplicationBuilder AddAppEmail(this IHostApplicationBuilder builder)
    {
        builder.Services.AddOptions<EmailOptions>()
            .Bind(builder.Configuration.GetSection("Email"))
            .Configure(o => o.PublicUrl = builder.Configuration["App:PublicUrl"] ?? o.PublicUrl)
            .ValidateDataAnnotations()
            .Validate(
                o => EmailLinks.IsValidPublicUrl(o.PublicUrl),
                "App:PublicUrl must be the frontend's absolute http(s) URL, e.g. https://localhost:5173 (set by the AppHost in development).")
            .ValidateOnStart();

        builder.Services.AddTransient<IEmailDelivery, MailKitEmailDelivery>();
        builder.Services.AddTransient<IEmailSender<IdentityUser>, IdentityEmailSender>();

        return builder;
    }
}
