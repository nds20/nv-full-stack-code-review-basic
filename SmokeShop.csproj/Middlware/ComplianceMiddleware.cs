using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
public class ComplianceMiddleware
{
    private readonly RequestDelegate _next;
public ComplianceMiddleware(RequestDelegate next)
    {
        _next = next;
    }
public async Task InvokeAsync(HttpContext context)
    {
        // Here we hook into our compliance logic
        // In a real scenario, you'd inject an IComplianceService
        bool isVerified = context.Session.GetString("AgeVerified") == "true";
// If the route is an "Order" or "Restricted" path, enforce the gate
        if (context.Request.Path.StartsWithSegments("/api/order") && !isVerified)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Access Denied: Age verification required.");
            return;
        }
await _next(context);
    }
}


