import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🌙 Running nightly doctor scan...");

    // Run doctor audit
    const { data: auditResult, error: auditError } = await supabase.functions.invoke(
      "doctor-audit",
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("VITE_ADMIN_SYNC_SECRET")}`,
        },
      }
    );

    if (auditError) {
      throw new Error(`Audit failed: ${auditError.message}`);
    }

    const hasCritical = auditResult?.summary?.critical > 0;

    if (hasCritical) {
      console.error(`❌ CRITICAL ISSUES DETECTED: ${auditResult.summary.critical}`);

      // Log critical findings
      const criticalFindings = auditResult.findings.filter(
        (f: any) => f.severity === "critical"
      );

      console.error("Critical findings:");
      criticalFindings.forEach((f: any) => {
        console.error(`  - ${f.title}: ${f.details}`);
      });

      // Set abort deploy flag
      await supabase.from("system_health_metrics").insert({
        metric_name: "nightly_doctor_critical_issues",
        metric_value: auditResult.summary.critical,
        severity: "critical",
        metadata: {
          findings: criticalFindings,
          timestamp: new Date().toISOString(),
        },
      });

      // Try to auto-repair if safe
      const autoFixable = criticalFindings.filter((f: any) => f.fix_available);

      if (autoFixable.length > 0) {
        console.log(`🔧 Attempting to auto-repair ${autoFixable.length} issues...`);

        const { data: repairResult, error: repairError } =
          await supabase.functions.invoke("doctor-repair", {
            headers: {
              Authorization: `Bearer ${Deno.env.get("VITE_ADMIN_SYNC_SECRET")}`,
            },
          });

        if (repairError) {
          console.error("Repair failed:", repairError);
        } else if (repairResult?.success) {
          console.log(`✅ Auto-repair successful!`);
          console.log(
            `   Fixed: ${repairResult.fixes_applied.filter((f: any) => f.success).length}`
          );

          // Check if critical issues resolved
          if (repairResult.after.summary.critical === 0) {
            console.log("🎉 All critical issues resolved!");

            await supabase.from("system_health_metrics").insert({
              metric_name: "nightly_doctor_auto_repaired",
              metric_value: repairResult.fixes_applied.length,
              severity: "info",
              metadata: {
                fixes: repairResult.fixes_applied,
                timestamp: new Date().toISOString(),
              },
            });
          } else {
            console.warn(
              `⚠️  ${repairResult.after.summary.critical} critical issues remain`
            );
          }
        }
      }

      return new Response(
        JSON.stringify({
          status: "critical_issues_detected",
          abort_deploy: true,
          audit: auditResult,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200, // Return 200 but signal abort in body
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // No critical issues
    console.log("✅ No critical issues detected");

    // Log warnings if any
    if (auditResult?.summary?.warning > 0) {
      console.warn(`⚠️  ${auditResult.summary.warning} warnings detected`);

      const warnings = auditResult.findings.filter((f: any) => f.severity === "warning");

      warnings.forEach((w: any) => {
        console.warn(`  - ${w.title}: ${w.details}`);
      });

      await supabase.from("system_health_metrics").insert({
        metric_name: "nightly_doctor_warnings",
        metric_value: auditResult.summary.warning,
        severity: "warning",
        metadata: {
          warnings,
          timestamp: new Date().toISOString(),
        },
      });
    }

    await supabase.from("system_health_metrics").insert({
      metric_name: "nightly_doctor_passed",
      metric_value: auditResult.summary.passed,
      severity: "info",
      metadata: {
        summary: auditResult.summary,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        status: "healthy",
        abort_deploy: false,
        audit: auditResult,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Nightly doctor failed:", error);

    return new Response(
      JSON.stringify({
        error: String(error),
        status: "error",
        abort_deploy: true,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
