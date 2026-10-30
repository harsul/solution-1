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

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
