using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
// Assuming your namespaces are named as follows:
using SignatureSmokeShop.Services; 
using SignatureSmokeShop.Middleware;
var builder = WebApplication.CreateBuilder(args);
// Add services to the container.
builder.Services.AddControllers();
// Register the 824 AI Engine™ Compliance Service for Dependency Injection
builder.Services.AddScoped<ComplianceService>();
var app = builder.Build();
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
app.UseHttpsRedirection();
// Inject our 824 Compliance Gatekeeper Middleware
app.UseMiddleware<ComplianceMiddleware>();
app.MapControllers();
app.Run();