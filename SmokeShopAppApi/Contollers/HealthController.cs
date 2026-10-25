using Microsoft.AspNetCore.Mvc;
namespace SmokeShopAppApi.Controllers;
[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            service = "SmokeShopAppApi",
            status = "healthy",
            environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                          ?? "Unknown"
        });
    }
}