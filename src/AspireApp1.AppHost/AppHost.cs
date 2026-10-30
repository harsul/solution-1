var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithPgAdmin();
var appDb = postgres.AddDatabase("appdb");

var server = builder.AddProject<Projects.AspireApp1_Server>("server")
    .WithReference(cache)
    .WaitFor(cache)
    .WithReference(appDb)
    .WaitFor(appDb)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

var webfrontend = builder.AddViteApp("webfrontend", "../frontend")
    .WithReference(server)
    .WaitFor(server);

// Development only: Mailpit catches all emails (web inbox linked from the Aspire dashboard), and
// links in emails point to the Vite dev server. When published, the server hosts the frontend
// itself; App__PublicUrl and a real email provider must be configured there.
if (builder.ExecutionContext.IsRunMode)
{
    var mailpit = builder.AddMailPit("mailpit");
    server
        .WithReference(mailpit)
        .WaitFor(mailpit)
        .WithEnvironment("App__PublicUrl", webfrontend.GetEndpoint("http"));
}

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
