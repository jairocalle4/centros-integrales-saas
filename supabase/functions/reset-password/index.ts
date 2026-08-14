import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Hardcode the user id we want to reset
    const userId = "c3d3dde1-b673-4f20-a9d6-0190ea253487";
    
    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password: "SuperAdmin123!"
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true, message: "Password updated successfully!" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
