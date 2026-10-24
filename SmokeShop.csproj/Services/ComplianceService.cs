using System.Collections.Generic;
public class ComplianceService
{
    public ComplianceResult AnalyzeConfiguration(ComplianceConfig config)
    {
        var analyzer = new AgeRestrictionAnalyzer();
        return analyzer.Analyze(config);
    }
}
public class ComplianceConfig
{
    public bool AgeGateEnabled { get; set; }
    public string VerificationProvider { get; set; }
    public bool VerificationBeforeCheckout { get; set; }
    public bool ServerSideEnforcement { get; set; }
    public bool BypassProtection { get; set; }
    public bool JurisdictionRulesConfigured { get; set; }
    public bool AuditLogging { get; set; }
    public bool PrivacyReviewCompleted { get; set; }
}
public class ComplianceResult
{
    public bool Passed { get; set; }
    public List<ComplianceFinding> Findings { get; set; }
}
public class ComplianceFinding
{
    public string Severity { get; set; }
    public string Rule { get; set; }
    public string Message { get; set; }
    public string Recommendation { get; set; }
}