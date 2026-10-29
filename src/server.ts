import { app } from "./app.js";
import { env, getSupabaseEnvironment, getToolGatewayEnvironment } from "./lib/env.js";

// Validate required database configuration at startup without making a health claim.
getSupabaseEnvironment();
if (env.TOOL_GATEWAY_ENABLED) {
  getToolGatewayEnvironment();
}
app.listen(env.PORT, () => {
  console.log(`Call2Kitchen backend listening on port ${env.PORT}`);
});
