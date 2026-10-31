using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;
using static AspireApp1.Server.xIntegration.TestDoubles.EmailHelpers;

namespace AspireApp1.Server.xIntegration;

/// <summary>Account changes through Identity's built-in <c>POST /api/auth/manage/info</c>.</summary>
public class ManageInfoTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private sealed record InfoDto(string Email, bool IsEmailConfirmed);

    private const string NewPassword = "N3wPassw0rd!";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> PostInfoAsync(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/auth/manage/info", body, Ct);

    private static async Task<string[]> ErrorCodesAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name).ToArray();
    }

    private static async Task<InfoDto> InfoAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<InfoDto>("/api/auth/manage/info", Ct))!;

    /// <summary>Calls the built-in confirm endpoint with all values (incl. <c>changedEmail</c>) from a frontend link.</summary>
    private static Task<HttpResponseMessage> ConfirmChangeAsync(HttpClient client, Uri link, string? code = null)
    {
        var query = QueryHelpers.ParseQuery(link.Query);
        return client.GetAsync(
            QueryHelpers.AddQueryString("/api/auth/confirmEmail", new Dictionary<string, string?>
            {
                ["userId"] = query["userId"],
                ["code"] = code ?? query["code"],
                ["changedEmail"] = query["changedEmail"],
            }), Ct);
    }

    [Fact]
    public async Task Changing_the_password_with_the_right_old_password_works()
    {
        var (client, email) = await SignedInClientAsync(factory);

        var response = await PostInfoAsync(client, new { oldPassword = ValidPassword, newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Changing_the_password_with_a_wrong_old_password_returns_PasswordMismatch()
    {
        var (client, email) = await SignedInClientAsync(factory);

        var response = await PostInfoAsync(client, new { oldPassword = "Wr0ng-password", newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("PasswordMismatch", await ErrorCodesAsync(response));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Changing_the_email_sends_one_link_to_the_new_address_and_changes_nothing_yet()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();

        var response = await PostInfoAsync(client, new { newEmail });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var message = Assert.Single(factory.Emails.SentTo(newEmail));
        Assert.Equal("Confirm your email address", message.Subject);
        var link = LinkIn(message.TextBody);
        Assert.Equal($"{ServerFactory.PublicUrl}/confirm-email", link.GetLeftPart(UriPartial.Path));
        Assert.Equal(newEmail, QueryHelpers.ParseQuery(link.Query)["changedEmail"]);
        Assert.Equal(email, (await InfoAsync(client)).Email);
    }

    [Fact]
    public async Task Following_the_link_changes_the_email_and_the_sign_in_name()
    {
        var (client, _) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();
        (await PostInfoAsync(client, new { newEmail })).EnsureSuccessStatusCode();
        var link = LinkIn(factory.Emails.SentTo(newEmail).Single().TextBody);

        var confirm = await ConfirmChangeAsync(factory.CreateHttpsClient(), link);

        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var fresh = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(fresh, newEmail)).StatusCode);
        Assert.Equal(newEmail, (await InfoAsync(fresh)).Email);
    }

    [Fact]
    public async Task A_tampered_change_link_returns_401_and_changes_nothing()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();
        (await PostInfoAsync(client, new { newEmail })).EnsureSuccessStatusCode();
        var link = LinkIn(factory.Emails.SentTo(newEmail).Single().TextBody);
        // One character in the middle: same length, still valid base64url.
        var code = QueryHelpers.ParseQuery(link.Query)["code"].ToString().ToCharArray();
        var middle = code.Length / 2;
        code[middle] = code[middle] == 'A' ? 'B' : 'A';

        var response = await ConfirmChangeAsync(client, link, new string(code));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(email, (await InfoAsync(client)).Email);
    }

    [Fact]
    public async Task A_change_link_for_an_address_taken_meanwhile_returns_401()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();
        (await PostInfoAsync(client, new { newEmail })).EnsureSuccessStatusCode();
        var link = LinkIn(factory.Emails.SentTo(newEmail).Single().TextBody);
        (await RegisterAsync(factory.CreateHttpsClient(), newEmail)).EnsureSuccessStatusCode();

        var response = await ConfirmChangeAsync(client, link);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(email, (await InfoAsync(client)).Email);
    }

    [Fact]
    public async Task Manage_info_needs_a_session()
    {
        var response = await PostInfoAsync(factory.CreateHttpsClient(), new { newEmail = NewEmail() });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
