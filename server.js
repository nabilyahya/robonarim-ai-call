import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
const VOICE = process.env.VOICE || "marin";

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in .env");
}

/**
 * Creates an ephemeral client secret for the browser (safe to expose to client).
 * Docs: POST /v1/realtime/client_secrets :contentReference[oaicite:2]{index=2}
 */
app.post("/session", async (req, res) => {
  try {
    const { instructions } = req.body || {};

    const sessionConfig = {
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        // صوت الإخراج
        audio: { output: { voice: VOICE } },
        // تعليمات Robonarim الأساسية (تقدر تعدلها لاحقاً)
        instructions:
          instructions ||
          `
أنت موظف Call Center محترف لشركة Robonarim (صيانة روبوتات/مكنسات).
هدفك: الرد بصوت هادئ ومقنع، جمع معلومات واضحة (الموديل، العطل، الولاية/المدينة، طريقة الإرسال كارجو/كوريه)،
وتشجيع العميل على إرسال الجهاز للفحص مع التأكيد: لا يتم أي إصلاح بدون موافقة.
استخدم التركية بشكل افتراضي. لا تذكر مدينة الشركة إلا إذا سُئلت.
          `.trim(),
      },
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!r.ok) {
      const t = await r.text();
      return res
        .status(500)
        .json({ error: "client_secrets_failed", details: t });
    }

    const data = await r.json();

    // في الوثائق المثال يطبع data.value كـ ephemeral key :contentReference[oaicite:3]{index=3}
    // حسب شكل الاستجابة عندك، لو كانت { value: "ek_..." } هذا كافي.
    return res.json({
      client_secret: data?.value || data?.client_secret || data,
      model: REALTIME_MODEL,
      voice: VOICE,
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "session_error", details: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Voice test server running: http://localhost:${PORT}`);
});
