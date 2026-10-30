using AspireApp1.Server.Auth;
using Microsoft.AspNetCore.Identity;

namespace AspireApp1.Server.xUnit;

public class RequireLetterPasswordValidatorTests
{
    private readonly RequireLetterPasswordValidator _validator = new();

    [Theory]
    [InlineData("12345678")]
    [InlineData("!!!!1234")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Rejects_passwords_without_a_letter(string? password)
    {
        var result = await _validator.ValidateAsync(null!, new IdentityUser(), password);

        Assert.False(result.Succeeded);
        Assert.Equal(RequireLetterPasswordValidator.ErrorCode, Assert.Single(result.Errors).Code);
    }

    [Theory]
    [InlineData("abc12345")]
    [InlineData("1234567a")]
    [InlineData("ćevap123")]
    [InlineData("𝐀1234567")]
    public async Task Accepts_passwords_with_a_letter(string password)
    {
        var result = await _validator.ValidateAsync(null!, new IdentityUser(), password);

        Assert.True(result.Succeeded);
    }
}
