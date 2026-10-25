using Microsoft.AspNetCore.Mvc;
using SignatureSmokeShop.Services;
namespace SignatureSmokeShop.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController : ControllerBase
    {
        private readonly ComplianceService _compliance;
public OrderController(ComplianceService compliance)
        {
            _compliance = compliance;
        }
[HttpPost("place")]
        public IActionResult PlaceOrder([FromBody] OrderRequest request)
        {
            // 1. Run the 824 AI Engine™ check before doing anything
            var config = new ComplianceConfig { AgeGateEnabled = true }; // Pull this from settings
            var result = _compliance.AnalyzeConfiguration(config);
if (!result.Passed)
            {
                return BadRequest(new { 
                    message = "Compliance check failed. Order blocked.", 
                    findings = result.Findings 
                });
            }
// 2. If we pass, proceed with logic
            return Ok(new { message = "Compliance verified. Order processing..." });
        }
    }
public class OrderRequest 
    {
        public string ProductId { get; set; }
        public int Quantity { get; set; }
    }
}