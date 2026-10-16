<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LavaManager — Promo vertical</title>
    <!-- Plantilla: edita index.html.tpl y ejecuta `python build.py` para regenerar index.html -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face {
        font-family: "Inter";
        src: url("assets/fonts/inter-latin-wght-normal.woff2") format("woff2");
        font-weight: 100 900;
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
      }
      @font-face {
        font-family: "Inter";
        src: url("assets/fonts/inter-latin-ext-wght-normal.woff2") format("woff2");
        font-weight: 100 900;
        unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
      }
      :root {
        --brand: #4f46e5;
        --brand-700: #4338ca;
        --sky: #0ea5e9;
        --brand-100: #e0e7ff;
        --ink: #0f172a;
        --muted: #64748b;
        --upcoming: #79828e;
        --wa: #25d366;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #f0f9ff; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Inter", ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: #f0f9ff; }
      #tint { position: absolute; inset: 0; background: #f0f9ff; }
      .blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; }
      #blob1 { width: 760px; height: 760px; left: -260px; top: -180px; background: #bae6fd; }
      #blob2 { width: 680px; height: 680px; right: -260px; top: 780px; background: #c7d2fe; }
      #blob3 { width: 600px; height: 600px; left: 100px; bottom: -280px; background: #a5f3fc; }

      .logo { display: block; }
      #brand { position: absolute; left: 0; right: 0; top: 96px; display: flex; justify-content: center; align-items: center; gap: 18px; }
      #brand .logo { width: 64px; height: 64px; }
      #brand span { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; }

      /* ── Gancho ── */
      #hook { position: absolute; inset: 0; }
      .mess { position: absolute; border-radius: 22px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, .14); padding: 22px 26px; font-size: 30px; font-weight: 700; display: flex; align-items: center; gap: 16px; }
      #m1 { left: 60px; top: 230px; background: #fee2e2; color: #991b1b; }
      #m2 { right: 50px; top: 380px; background: #dcfce7; color: #14532d; }
      #m3 { left: 120px; top: 560px; background: #fef9c3; color: #713f12; font-size: 27px; }
      #m4 { left: 70px; top: 1400px; background: #ede9fe; color: #4c1d95; }
      #m5 { right: 60px; top: 1580px; background: #fff7ed; color: #9a3412; }
      .q { position: absolute; left: 50px; right: 50px; top: 720px; text-align: center; font-size: 90px; line-height: 1.07; font-weight: 900; letter-spacing: -0.035em; }
      .q .ln { display: block; }
      .q .w { color: var(--upcoming); }
      #q2 { top: 640px; }
      #basket { position: absolute; left: 0; right: 0; top: 1150px; text-align: center; font-size: 170px; opacity: 0; }
      #basket span { display: inline-block; }
      #hookLogo { position: absolute; left: 0; right: 0; top: 850px; display: flex; justify-content: center; }
      #hookLogo .logo { width: 220px; height: 220px; filter: drop-shadow(0 30px 60px rgba(79, 70, 229, .45)); }

      /* ── Titulares ── */
      .hl { position: absolute; left: 50px; right: 50px; top: 205px; text-align: center; }
      .chip { display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px; border-radius: 999px; background: var(--brand-100); color: var(--brand-700); font-size: 28px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
      .chip.premium { margin-left: 10px; background: linear-gradient(90deg, #f59e0b, #f97316); color: #fff; }
      .hl h2 { margin-top: 22px; font-size: 76px; line-height: 1.06; font-weight: 900; letter-spacing: -0.035em; }
      .hl h2 em { font-style: normal; color: var(--brand); }

      /* ── Ventana de la app ── */
      #card { position: absolute; left: 40px; top: 500px; width: 1000px; height: 916px; border-radius: 34px; overflow: hidden; background: #fff; box-shadow: 0 40px 100px rgba(30, 27, 75, .22), 0 0 0 2px rgba(79, 70, 229, .1); }
      #bar { position: absolute; left: 0; right: 0; top: 0; height: 56px; background: #f1f5f9; display: flex; align-items: center; padding: 0 24px; gap: 10px; border-bottom: 1px solid #e2e8f0; }
      #bar i { width: 14px; height: 14px; border-radius: 50%; background: #cbd5e1; display: block; }
      #bar b { margin-left: 18px; flex: 1; height: 34px; border-radius: 10px; background: #fff; font-size: 20px; font-weight: 600; color: var(--muted); display: flex; align-items: center; padding-left: 16px; }
      #vp { position: absolute; left: 0; top: 56px; width: 1000px; height: 860px; overflow: hidden; background: #f1f5f9; }
      .slot { position: absolute; left: 0; top: 0; width: 1000px; height: 860px; }
      .zw { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
      .zw video { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
      .cur { position: absolute; left: 0; top: 0; width: 30px; height: 30px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .35)); }
      .rip { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: rgba(79, 70, 229, .5); opacity: 0; }
      .spot { position: absolute; border-radius: 14px; border: 3px solid var(--brand); box-shadow: 0 0 0 4000px rgba(15, 23, 42, .6); opacity: 0; }

      /* ── Teléfonos ── */
      .phone { position: absolute; left: 305px; top: 430px; width: 470px; height: 960px; border-radius: 64px; background: #0f172a; padding: 16px; box-shadow: 0 50px 110px rgba(15, 23, 42, .35); }
      .phone .screen { position: relative; width: 100%; height: 100%; border-radius: 50px; overflow: hidden; background: #fff; }
      /* Altura explícita (proporción real 780x1688) para que el render no recoloque el cuadro */
      .phone video { position: absolute; left: 0; top: 0; width: 100%; height: 948px; object-fit: cover; object-position: top center; }
      .float { position: absolute; display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 22px; padding: 18px 24px; font-size: 28px; font-weight: 800; box-shadow: 0 20px 50px rgba(15, 23, 42, .15); }
      #fa1 { left: 30px; top: 600px; }
      #fa2 { right: 30px; top: 1000px; }
      #f1 { left: 30px; top: 560px; }
      #f2 { right: 30px; top: 820px; }
      #f3 { left: 30px; top: 1080px; }

      /* ── Celular del cliente: aviso de percha ── */
      #clientPhone { position: absolute; left: 620px; top: 650px; width: 400px; height: 820px; border-radius: 62px; background: #0f172a; padding: 14px; box-shadow: 0 50px 120px rgba(15, 23, 42, .45); }
      #clientPhone .lock { position: relative; width: 100%; height: 100%; border-radius: 48px; overflow: hidden; background: linear-gradient(160deg, #0ea5e9 0%, #4f46e5 60%, #7c3aed 100%); color: #fff; text-align: center; }
      #clientPhone .clock { margin-top: 70px; font-size: 96px; font-weight: 300; letter-spacing: -0.02em; }
      #clientPhone .date { font-size: 24px; font-weight: 600; opacity: .9; }
      #clientPhone .pet { position: absolute; left: 0; right: 0; bottom: 80px; font-size: 160px; line-height: 1; }
      #notif { position: absolute; left: 14px; right: 14px; top: 300px; border-radius: 26px; padding: 16px 18px; background: rgba(255, 255, 255, .93); color: #111827; text-align: left; box-shadow: 0 10px 30px rgba(0, 0, 0, .25); }
      #notif .row { display: flex; align-items: center; gap: 10px; font-size: 19px; color: #6b7280; font-weight: 600; }
      #notif .app { width: 34px; height: 34px; border-radius: 9px; background: var(--wa); display: flex; align-items: center; justify-content: center; }
      #notif .ttl { margin-top: 8px; font-size: 22px; font-weight: 800; }
      #notif .body { margin-top: 4px; font-size: 20px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
      #premium { position: absolute; left: 50px; top: 1120px; padding: 26px 40px; border-radius: 26px; background: linear-gradient(120deg, #f59e0b, #f97316 55%, #fbbf24); color: #fff; font-size: 52px; font-weight: 900; letter-spacing: .02em; box-shadow: 0 24px 60px rgba(249, 115, 22, .45); overflow: hidden; }
      #premium small { display: block; font-size: 24px; font-weight: 700; letter-spacing: 0; opacity: .95; }
      #premium .shine { position: absolute; top: -20%; left: 0; width: 60px; height: 140%; background: rgba(255, 255, 255, .55); filter: blur(6px); }

      /* ── Sellos ── */
      .stamp { position: absolute; left: 0; right: 0; display: flex; justify-content: center; }
      .stamp div { padding: 22px 36px; border-radius: 24px; color: #fff; font-size: 44px; font-weight: 900; box-shadow: 0 24px 60px rgba(15, 23, 42, .25); }
      #okSri { top: 1180px; }
      #okSri div { background: linear-gradient(120deg, #059669, #10b981); }
      #lock { top: 1200px; }
      #lock div { background: linear-gradient(120deg, #0f172a, #334155); }

      /* ── Burbujas, mascotas, confeti ── */
      .bub { position: absolute; left: 0; top: 0; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, .95), rgba(186, 230, 253, .55) 45%, rgba(14, 165, 233, .25) 70%, rgba(79, 70, 229, .35)); border: 2px solid rgba(255, 255, 255, .8); opacity: 0; }
      .mascot { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 10px; opacity: 0; }
      .mascot .emo { font-size: 128px; line-height: 1; filter: drop-shadow(0 14px 22px rgba(15, 23, 42, .25)); }
      .mascot .bubble { position: relative; background: #fff; border-radius: 26px; padding: 16px 22px; font-size: 32px; font-weight: 800; color: var(--ink); box-shadow: 0 16px 40px rgba(15, 23, 42, .18); white-space: nowrap; }
      .mascot .bubble::after { content: ""; position: absolute; right: -14px; top: 50%; margin-top: -12px; border: 12px solid transparent; border-left-color: #fff; border-right: 0; }
      .cf { position: absolute; left: 0; top: 0; width: 16px; height: 26px; border-radius: 4px; opacity: 0; }

      /* ── Cierre ── */
      #close { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding-top: 250px; }
      #closeLogo { width: 200px; height: 200px; filter: drop-shadow(0 30px 60px rgba(79, 70, 229, .4)); }
      #closeName { margin-top: 32px; font-size: 100px; font-weight: 900; letter-spacing: -0.04em; }
      #closeFor { margin-top: 6px; font-size: 32px; font-weight: 700; color: var(--muted); text-align: center; padding: 0 60px; }
      #closeTag { margin-top: 36px; font-size: 54px; line-height: 1.15; font-weight: 800; text-align: center; letter-spacing: -0.02em; padding: 0 40px; }
      #closeTag em { font-style: normal; color: var(--brand); }
      #cta { margin-top: 50px; padding: 30px 60px; border-radius: 999px; background: var(--brand); color: #fff; font-size: 46px; font-weight: 800; box-shadow: 0 24px 60px rgba(79, 70, 229, .45); }
      .contact { margin-top: 28px; display: flex; align-items: center; gap: 20px; font-size: 52px; font-weight: 800; }
      .contact .ic { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--wa); }
      .closePet { position: absolute; top: 330px; font-size: 140px; opacity: 0; }
      #cpL { left: 70px; }
      #cpR { right: 70px; }

      /* ── Subtítulos ── */
      #caps { position: absolute; left: 50px; right: 50px; top: 1490px; height: 220px; }
      .cap { position: absolute; left: 0; right: 0; top: 0; display: flex; justify-content: center; opacity: 0; }
      .pill { max-width: 980px; text-align: center; font-size: 58px; line-height: 1.16; font-weight: 900; letter-spacing: -0.02em; background: rgba(255, 255, 255, .9); border-radius: 30px; padding: 14px 30px 18px; box-shadow: 0 16px 40px rgba(15, 23, 42, .12); }
      .cap span { color: var(--upcoming); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="61.5" data-width="1080" data-height="1920">
      <div id="tint"></div>
      <div class="blob" id="blob1" data-layout-allow-overflow></div>
      <div class="blob" id="blob2" data-layout-allow-overflow></div>
      <div class="blob" id="blob3" data-layout-allow-overflow></div>

      <!-- ── Narración (voz es-EC Andrea) ── -->
      <audio id="vo1" src="assets/voz/01-gancho.mp3" data-start="0.30" data-duration="5.98" data-track-index="10"></audio>
      <audio id="vo2" src="assets/voz/02-recepcion.mp3" data-start="6.58" data-duration="5.95" data-track-index="11"></audio>
      <audio id="vo3" src="assets/voz/03-taller.mp3" data-start="12.83" data-duration="6.07" data-track-index="10"></audio>
      <audio id="vo4" src="assets/voz/04-whatsapp.mp3" data-start="19.20" data-duration="6.58" data-track-index="11"></audio>
      <audio id="vo5" src="assets/voz/05-cobro.mp3" data-start="26.08" data-duration="10.42" data-track-index="10"></audio>
      <audio id="vo6" src="assets/voz/06-caja.mp3" data-start="36.80" data-duration="3.96" data-track-index="11"></audio>
      <audio id="vo7" src="assets/voz/07-dueno.mp3" data-start="41.06" data-duration="5.62" data-track-index="10"></audio>
      <audio id="vo8" src="assets/voz/08-reportes.mp3" data-start="46.98" data-duration="5.26" data-track-index="11"></audio>
      <audio id="vo9" src="assets/voz/09-cierre.mp3" data-start="52.54" data-duration="7.27" data-track-index="10"></audio>

      <!-- ── 0 · Gancho ── -->
      <section id="hook" class="clip" data-start="0" data-duration="6.40" data-track-index="1">
        <div class="mess" id="m1">📒 Pedidos en papel</div>
        <div class="mess" id="m2">👕 “¿De quién es esta camisa?”</div>
        <div class="mess" id="m3">📞 12 llamadas perdidas</div>
        <div class="mess" id="m4">💬 “¿Ya está lista mi ropa?”</div>
        <div class="mess" id="m5">🧾 Ticket a mano N° 087</div>
        <h1 class="q" id="q1">
          <span class="ln"><span class="w">¿Pedidos</span> <span class="w">en</span> <span class="w">papel</span></span>
          <span class="ln"><span class="w">y</span> <span class="w">prendas</span> <span class="w">que</span></span>
          <span class="ln"><span class="w">se</span> <span class="w">confunden?</span></span>
        </h1>
        <h1 class="q" id="q2">
          <span class="ln"><span class="w">Organiza</span> <span class="w">tu</span></span>
          <span class="ln"><span class="w">lavandería</span></span>
        </h1>
        <div id="basket"><span>🧺</span></div>
        <div id="hookLogo"><img class="logo" src="assets/img/logo.svg" alt="" /></div>
      </section>

      <div id="brand"><img class="logo" src="assets/img/logo.svg" alt="" /><span>LavaManager</span></div>

      <!-- ── Titulares de beneficio ── -->
      <div class="hl clip" id="hl1" data-start="6.50" data-duration="6.33" data-track-index="2"><div class="chip">Recepción · POS</div><h2>Cada orden, <em>organizada</em></h2></div>
      <div class="hl clip" id="hl2" data-start="12.83" data-duration="6.37" data-track-index="2"><div class="chip">Taller</div><h2>Cada pedido, <em>a la vista</em></h2></div>
      <div class="hl clip" id="hl3" data-start="19.20" data-duration="6.88" data-track-index="2"><div class="chip">WhatsApp automático</div><div class="chip premium">Plan Premium</div><h2>Avisa <em>sin escribir</em></h2></div>
      <div class="hl clip" id="hl4" data-start="26.08" data-duration="10.72" data-track-index="2"><div class="chip">Entrega · Recibo · SRI</div><h2>Recibo o <em>factura</em></h2></div>
      <div class="hl clip" id="hl5" data-start="36.80" data-duration="4.26" data-track-index="2"><div class="chip">Caja por turnos</div><h2>Caja <em>cuadrada</em></h2></div>
      <div class="hl clip" id="hl6" data-start="41.06" data-duration="5.92" data-track-index="2"><div class="chip">Para el dueño</div><h2>Tu negocio, <em>en tu bolsillo</em></h2></div>
      <div class="hl clip" id="hl7" data-start="46.98" data-duration="5.56" data-track-index="2"><div class="chip">Reportes</div><h2>Ventas y <em>kilos lavados</em></h2></div>

      <!-- Celular del dueño (panel en el teléfono) -->
      <div class="phone" id="phoneA"><div class="screen" data-layout-allow-overflow>
        <video id="v-pa" src="assets/clips/movil-panel.mp4" muted playsinline data-start="41.06" data-duration="3.24" data-media-start="0.2" data-track-index="4"></video>
      </div></div>
      <div class="float" id="fa1">📍 Estés donde estés</div>
      <div class="float" id="fa2">💰 Ventas de hoy</div>

      <!-- ── Ventana de la app (zoom + cursor dibujado a 30 fps) ── -->
      <div id="card">
        <div id="bar"><i></i><i></i><i></i><b>LavaManager · Panel de la lavandería</b></div>
        <div id="vp" data-layout-allow-overflow>
          <!--@VIDEOS@-->
        </div>
      </div>

      <!-- Celular del cliente: aviso de percha (texto real de la app) -->
      <div id="clientPhone"><div class="lock">
        <div class="clock">9:19</div><div class="date">jueves, 15 de octubre</div>
        <div id="notif">
          <div class="row"><div class="app"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg></div>WHATSAPP · ahora</div>
          <div class="ttl">LavaWash Express</div>
          <div class="body">🧺 ¡Hola Ana Lucía Torres! Tus prendas de la orden #LAV-2026-0054 ya están listas para retiro ✨ 📍 Ubicación: Percha A-01. Ya puedes retirarlas en LavaWash Express. ¡Te esperamos! 🙌</div>
        </div>
        <div class="pet">👔</div>
      </div></div>
      <div id="premium">⭐ PLAN PREMIUM<small>WhatsApp automático incluido</small><div class="shine"></div></div>

      <div class="stamp" id="okSri"><div>✅ Factura SRI autorizada</div></div>
      <div class="stamp" id="lock"><div>🔒 Solo el dueño ve los reportes</div></div>

      <!-- Teléfono grande: reportes en el celular -->
      <div class="phone" id="phoneL"><div class="screen" data-layout-allow-overflow>
        <video id="v-pl" src="assets/clips/movil-reportes.mp4" muted playsinline data-start="49.20" data-duration="3.34" data-media-start="0.2" data-track-index="4"></video>
      </div></div>
      <div class="float" id="f1">💻 Computadora</div>
      <div class="float" id="f2">📲 Tablet</div>
      <div class="float" id="f3">📱 Celular</div>

      <!-- ── Cierre (sin links) ── -->
      <section id="close" class="clip" data-start="52.40" data-duration="9.10" data-track-index="1">
        <div class="closePet" id="cpL">👕</div><div class="closePet" id="cpR">🧺</div>
        <img id="closeLogo" src="assets/img/logo.svg" alt="" />
        <div id="closeName">LavaManager</div>
        <div id="closeFor">Para lavanderías, tintorerías y centros de lavado</div>
        <div id="closeTag">Tu lavandería organizada,<em> tus clientes siempre avisados.</em></div>
        <div id="cta">Pide tu demostración</div>
        <div class="contact" id="ctWa">
          <div class="ic"><svg width="46" height="46" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.1 13.9c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.1 0 .3 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.2.4-.3.4c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.7 1.1 1.9 1.2.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.2z"/></svg></div>
          099 169 3863
        </div>
      </section>

      <div class="mascot" id="ma"><div class="bubble">¡Todo bajo control!</div><div class="emo">🧺</div></div>
      <div class="mascot" id="mb"><div class="bubble">¡Recibido! 👍</div><div class="emo">👕</div></div>
      <div class="mascot" id="mc"><div class="bubble">¡Ya me estoy lavando! 🫧</div><div class="emo">🧦</div></div>
      <div class="mascot" id="md"><div class="bubble">¡Pagado y facturado!</div><div class="emo">🧾</div></div>
      <div class="mascot" id="me"><div class="bubble">¡Cuadre perfecto!</div><div class="emo">💰</div></div>
      <div id="bubbles"></div>
      <div id="confetti"></div>
      <div id="caps"></div>
    </div>

    <script>
      const SHOTS = /*@SHOTS@*/[];
      const tl = gsap.timeline({ paused: true });

      // ── Elementos repetidos (burbujas y confeti) ──
      const bubHost = document.getElementById("bubbles");
      const BS = [70, 110, 54, 90, 130, 64, 100, 80];
      BS.forEach((sz, i) => { const b = document.createElement("div"); b.className = "bub"; b.style.width = b.style.height = sz + "px"; bubHost.appendChild(b); });
      const cfHost = document.getElementById("confetti");
      for (let i = 0; i < 26; i++) { const c = document.createElement("div"); c.className = "cf"; cfHost.appendChild(c); }

      // ── Fondo vivo y tinte por sección ──
      tl.fromTo("#blob1", { x: 0, y: 0 }, { x: 140, y: 100, duration: 61.5, ease: "sine.inOut" }, 0);
      tl.fromTo("#blob2", { x: 0, y: 0 }, { x: -160, y: -140, duration: 61.5, ease: "sine.inOut" }, 0);
      tl.fromTo("#blob3", { x: 0, y: 0 }, { x: 100, y: -80, duration: 61.5, ease: "sine.inOut" }, 0);
      [[0, "#f0f9ff"], [6.58, "#ecfeff"], [12.83, "#f0f9ff"], [19.2, "#f0fdf4"], [26.08, "#f5f3ff"], [36.8, "#fefce8"], [41.06, "#eef2ff"], [46.98, "#ecfeff"], [52.4, "#f0f9ff"]]
        .forEach(([t, c], i) => (i === 0 ? tl.set("#tint", { backgroundColor: c }, 0) : tl.to("#tint", { backgroundColor: c, duration: 0.5, ease: "sine.inOut" }, t - 0.2)));

      // ── Gancho: caos de papeles → "Organiza tu lavandería" → logo ──
      const mess = ["#m1", "#m2", "#m3", "#m4", "#m5"];
      const rot = [-6, 5, -4, 5, -6];
      mess.forEach((id, i) => {
        tl.fromTo(id, { opacity: 0, scale: 0.6, rotation: rot[i] * 3, y: 40 }, { opacity: 1, scale: 1, rotation: rot[i], y: 0, duration: 0.45, ease: "back.out(1.8)" }, 0.1 + i * 0.25);
        tl.to(id, { rotation: rot[i] * -0.6, duration: 0.16, repeat: 5, yoyo: true, ease: "sine.inOut" }, 1.6 + i * 0.05);
        tl.to(id, { x: i % 2 ? 420 : -420, scale: 0.4, opacity: 0, rotation: rot[i] * 4, duration: 0.4, ease: "power3.in" }, 2.9 + i * 0.04);
      });
      const L1 = [0.1, 0.51, 0.62, 0.96, 1.03, 1.42, 1.51, 1.64, 3.02, 3.55, 3.66];
      const qw = [...document.querySelectorAll("#q1 .w"), ...document.querySelectorAll("#q2 .w")];
      tl.fromTo("#q1", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.1);
      qw.forEach((w, i) => tl.to(w, { color: i >= 8 ? "#4f46e5" : "#0f172a", duration: 0.12 }, 0.3 + L1[i]));
      tl.fromTo("#basket", { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.45, ease: "back.out(2)" }, 0.9);
      tl.to("#basket span", { rotation: 12, duration: 0.25, repeat: 5, yoyo: true, ease: "sine.inOut" }, 1.4);
      tl.to(["#q1", "#basket"], { opacity: 0, y: -50, duration: 0.25, ease: "power2.in" }, 2.95);
      tl.fromTo("#q2", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.6)" }, 3.2);
      tl.to("#q2", { opacity: 0, y: -60, duration: 0.25, ease: "power2.in" }, 4.55);
      tl.fromTo("#hookLogo .logo", { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.4, ease: "back.out(2)" }, 4.65);
      tl.to("#hookLogo .logo", { scale: 0.29, y: -832, x: -150, duration: 0.4, ease: "power3.inOut" }, 5.9);

      // ── Marca superior ──
      tl.set("#brand", { opacity: 0 }, 0);
      tl.to("#brand", { opacity: 1, duration: 0.2 }, 6.25);
      tl.to("#brand", { opacity: 0, duration: 0.3 }, 52.3);

      // ── Titulares ──
      document.querySelectorAll(".hl").forEach((el) => {
        const s = parseFloat(el.dataset.start);
        tl.fromTo(el.querySelectorAll(".chip"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.08, ease: "power3.out" }, s + 0.02);
        tl.fromTo(el.querySelector("h2"), { opacity: 0, y: 36, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.45, ease: "power3.out" }, s + 0.08);
      });

      // ── Ventana: tomas con zoom, cursor y transiciones ──
      const VW = 1000;
      const R = ([rx, ry, rw]) => { const s = VW / rw; return { x: -rx * s, y: -ry * s, scale: s }; };
      tl.set("#card", { opacity: 0 }, 0);
      tl.fromTo("#card", { opacity: 0, y: 90, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" }, 6.35);
      tl.to("#card", { opacity: 0, y: -60, scale: 0.94, duration: 0.3, ease: "power2.in" }, 40.85);
      tl.fromTo("#card", { opacity: 0, y: 90, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, 44.15);
      tl.to("#card", { opacity: 0, y: -60, scale: 0.94, duration: 0.3, ease: "power2.in" }, 49.0);
      SHOTS.forEach((sh, i) => {
        const slot = `#s-${sh.id}`, zw = `#z-${sh.id}`;
        const end = sh.start + sh.dur;
        tl.set(slot, { opacity: 0 }, 0);
        if (i === 0 || sh.id === "a") tl.set(slot, { opacity: 1 }, sh.start);
        else tl.fromTo(slot, { opacity: 0, x: 180, filter: "blur(12px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.32, ease: "power3.out" }, sh.start);
        tl.set(slot, { opacity: 0 }, end);
        const [m0, m1] = sh.move || [0.15, sh.dur - 0.1];
        tl.set(zw, { transformOrigin: "0 0", ...R(sh.frm) }, 0);
        tl.to(zw, { ...R(sh.to), duration: m1 - m0, ease: "power2.inOut" }, sh.start + m0);
        if (sh.spot) {
          const [x, y, w, h] = sh.spot;
          tl.set(`${slot} .spot`, { left: x - 8, top: y - 6, width: w + 16, height: h + 12 }, 0);
          tl.fromTo(`${slot} .spot`, { opacity: 0 }, { opacity: 1, duration: 0.4 }, sh.start + Math.min(0.9, sh.dur * 0.35));
        }
        const cur = `${slot} .cur`, rip = `${slot} .rip`;
        if (sh.pts.length === 0) tl.set(cur, { opacity: 0 }, 0);
        let lastKept = null;
        sh.pts.forEach(([t, x, y], k) => {
          if (k === 0) { tl.set(cur, { x: x - 5, y: y - 3 }, t); lastKept = t; return; }
          if (t - lastKept < 0.1 && k !== sh.pts.length - 1) return;
          tl.to(cur, { x: x - 5, y: y - 3, duration: t - lastKept, ease: "none" }, lastKept);
          lastKept = t;
        });
        sh.clicks.forEach((t) => {
          const last = sh.pts.filter((p) => p[0] <= t).pop() || sh.pts[0];
          tl.set(rip, { x: last[1], y: last[2] }, t);
          tl.fromTo(rip, { scale: 0.4, opacity: 0.85 }, { scale: 4.5, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, t);
        });
      });

      // ── Celular del cliente + sello Premium ──
      tl.set(["#clientPhone", "#premium"], { opacity: 0 }, 0);
      tl.fromTo("#clientPhone", { opacity: 0, x: 260, rotation: 10 }, { opacity: 1, x: 0, rotation: 4, duration: 0.55, ease: "power3.out" }, 21.4);
      tl.fromTo("#notif", { y: -340, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "elastic.out(1, 0.55)" }, 21.95);
      tl.fromTo("#clientPhone .pet", { y: 0 }, { y: -18, duration: 0.3, repeat: 9, yoyo: true, ease: "sine.inOut" }, 22.3);
      tl.to("#clientPhone", { opacity: 0, x: 220, duration: 0.3, ease: "power2.in" }, 25.75);
      tl.fromTo("#premium", { opacity: 0, scale: 0.6, rotation: -14 }, { opacity: 1, scale: 1, rotation: -6, duration: 0.6, ease: "back.out(2.2)" }, 19.4);
      tl.fromTo("#premium .shine", { x: -80 }, { x: 560, duration: 0.7, ease: "power2.inOut", repeat: 3, repeatDelay: 0.6 }, 20.0);
      tl.to("#premium", { opacity: 0, scale: 0.8, duration: 0.3, ease: "power2.in" }, 25.7);

      // ── Sellos ──
      tl.set(["#okSri", "#lock"], { opacity: 0 }, 0);
      tl.fromTo("#okSri", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 35.0);
      tl.to("#okSri", { opacity: 0, duration: 0.25 }, 36.6);
      tl.fromTo("#lock", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 47.6);
      tl.to("#lock", { opacity: 0, duration: 0.25 }, 48.95);

      // ── Celular del dueño ──
      tl.set(["#phoneA", "#fa1", "#fa2"], { opacity: 0 }, 0);
      tl.fromTo("#phoneA", { opacity: 0, y: 160 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 41.0);
      tl.fromTo("#fa2", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.4, ease: "back.out(1.6)" }, 42.2);
      tl.fromTo("#fa1", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.4, ease: "back.out(1.6)" }, 42.9);
      tl.to(["#phoneA", "#fa1", "#fa2"], { opacity: 0, y: -40, duration: 0.3, ease: "power2.in" }, 44.0);

      // ── Teléfono grande: reportes en el celular ──
      tl.set(["#phoneL", "#f1", "#f2", "#f3"], { opacity: 0 }, 0);
      tl.fromTo("#phoneL", { opacity: 0, y: 160 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 49.15);
      [["#f1", 49.5], ["#f2", 50.2], ["#f3", 50.75]].forEach(([id, t]) => tl.fromTo(id, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.4, ease: "back.out(1.6)" }, t));
      tl.to(["#phoneL", "#f1", "#f2", "#f3", "#hl7 .chip", "#hl7 h2"], { opacity: 0, y: -40, duration: 0.3, ease: "power2.in" }, 52.2);

      // ── Burbujas de jabón en cada cambio de sección ──
      const bubs = [...document.querySelectorAll(".bub")];
      tl.set(bubs, { opacity: 0 }, 0);
      [12.83, 19.20, 26.08, 36.80, 41.06, 46.98].forEach((T, n) => {
        bubs.forEach((b, k) => {
          const x = 60 + ((k * 137 + n * 61) % 900);
          tl.set(b, { x, y: 1950, scale: 0.7 }, T - 0.55);
          tl.to(b, { opacity: 0.95, duration: 0.15 }, T - 0.55 + k * 0.05);
          tl.to(b, { y: 1950 - 900 - (k % 3) * 250, x: x + (k % 2 ? 60 : -60), scale: 1.1, duration: 0.9, ease: "power1.out" }, T - 0.55 + k * 0.05);
          tl.to(b, { opacity: 0, scale: 1.5, duration: 0.15 }, T - 0.55 + k * 0.05 + 0.8);
        });
      });

      // ── Mascotas con globito ──
      const MASC = [["#mb", 7.0, 12.5], ["#mc", 13.3, 18.85], ["#md", 35.2, 36.55], ["#me", 37.2, 40.75], ["#ma", 44.6, 46.75]];
      MASC.forEach(([id, a, b], k) => {
        tl.set(id, { x: 380, y: 418, opacity: 0 }, 0);
        tl.fromTo(id, { opacity: 0, scale: 0.4, y: 460 }, { opacity: 1, scale: 1, y: 418, duration: 0.5, ease: "back.out(2)" }, a);
        tl.to(`${id} .emo`, { rotation: k % 2 ? 8 : -8, duration: 0.35, repeat: Math.max(1, Math.floor((b - a - 0.9) / 0.35)), yoyo: true, ease: "sine.inOut" }, a + 0.5);
        tl.to(id, { opacity: 0, scale: 0.6, duration: 0.25, ease: "power2.in" }, b);
      });

      // ── Confeti determinista ──
      const CF = [...document.querySelectorAll(".cf")];
      const CFC = ["#4f46e5", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#a855f7"];
      CF.forEach((el, i) => tl.set(el, { backgroundColor: CFC[i % CFC.length] }, 0));
      const burst = (t, cx, cy) => {
        CF.forEach((el, i) => {
          const ang = i * 0.83, dist = 180 + (i % 5) * 60;
          tl.set(el, { x: cx, y: cy, rotation: 0, opacity: 0 }, t - 0.01);
          tl.to(el, { opacity: 1, x: cx + Math.cos(ang) * dist, y: cy - 160 - Math.sin(ang) * dist * 0.8, rotation: 180 + i * 37, duration: 0.6, ease: "power2.out" }, t + i * 0.01);
          tl.to(el, { y: `+=${420 + (i % 4) * 60}`, rotation: `+=${200 + i * 11}`, opacity: 0, duration: 1.0, ease: "power1.in" }, t + 0.6 + i * 0.01);
        });
      };
      burst(35.05, 540, 1100);
      burst(39.2, 540, 900);
      burst(57.6, 540, 1050);

      // ── Cierre (sin links) ──
      tl.fromTo("#closeLogo", { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.55, ease: "back.out(2)" }, 52.5);
      tl.fromTo("#closeName", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 52.65);
      tl.fromTo("#closeFor", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 53.0);
      tl.fromTo("#closeTag", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 53.7);
      tl.fromTo("#cta", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, 57.35);
      tl.to("#cta", { scale: 1.06, duration: 0.4, repeat: 5, yoyo: true, ease: "sine.inOut" }, 57.85);
      tl.fromTo("#ctWa", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 58.2);
      tl.fromTo(["#cpL", "#cpR"], { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.15, ease: "back.out(2.2)" }, 52.8);
      tl.to("#cpL", { y: -40, duration: 0.35, repeat: 11, yoyo: true, ease: "sine.inOut" }, 53.4);
      tl.to("#cpR", { y: -40, duration: 0.35, repeat: 11, yoyo: true, ease: "sine.inOut" }, 53.6);

      // ── Subtítulos con resaltado por palabra ──
      const lines = [
        [6.58, 5.95, [0.1, 0.41, 0.53, 0.79, 0.96, 1.32, 1.4, 1.57, 2.18, 2.6, 2.69, 3.07, 3.18, 3.53, 3.68, 3.98, 4.19, 4.3, 4.63, 4.76],
          [["Recibe", "la", "ropa"], ["por", "kilo", "o", "por", "prenda,"], ["registra", "el", "abono"], ["y", "entrega", "un", "ticket"], ["con", "su", "número", "de", "orden."]]],
        [12.83, 6.07, [0.1, 0.22, 0.34, 1.05, 1.34, 1.66, 2.32, 3.05, 3.86, 4.14, 4.26, 4.65, 4.74],
          [["En", "el", "taller,"], ["cada", "orden", "avanza:"], ["recibido,", "lavándose,"], ["listo", "en", "percha"], ["y", "entregado."]]],
        [19.20, 6.58, [0.1, 0.2, 0.34, 0.48, 0.71, 1.34, 1.46, 1.78, 2.12, 2.25, 2.54, 3.13, 3.36, 3.5, 3.78, 4.01, 4.64, 4.81, 4.93, 4.99, 5.44],
          [["Y", "con", "el", "plan", "Premium,"], ["el", "cliente", "recibe"], ["un", "WhatsApp", "automático"], ["cuando", "su", "ropa", "está", "lista,"], ["sin", "que", "tú", "escribas", "nada."]]],
        [26.08, 10.42, [0.1, 0.27, 0.97, 1.26, 1.39, 1.72, 1.78, 2.2, 2.32, 2.69, 2.87, 3.0, 3.63, 3.69, 3.83, 3.93, 4.68, 5.17, 5.3, 5.71, 6.16, 6.55, 6.65, 6.95, 7.61, 7.77, 7.98, 8.35, 8.43, 8.67, 9.22],
          [["Al", "retirar,"], ["cobras", "el", "saldo"], ["e", "imprimes", "el", "recibo"], ["para", "tu", "cliente;"], ["y", "si", "lo", "desea,"], ["facturas", "al", ["SRI", 3]], ["el", "mismo", "pedido,"], ["con", "sus", "datos"], ["o", "como", "consumidor", "final."]]],
        [36.80, 3.96, [0.1, 0.32, 0.63, 0.74, 1.03, 1.15, 1.48, 1.64, 2.31, 2.46, 2.74],
          [["Cada", "turno", "de", "caja"], ["se", "cierra", "con", "arqueo,"], ["y", "todo", "cuadra."]]],
        [41.06, 5.62, [0.1, 0.19, 0.34, 0.54, 0.65, 1.23, 1.41, 1.5, 1.89, 1.98, 2.07, 2.18, 2.54, 2.61, 2.73, 2.82, 2.94, 3.49, 3.73, 3.94, 4.29, 4.39, 4.47],
          [["Y", "si", "eres", "el", "dueño,"], ["ves", "al", "momento"], ["lo", "que", "se", "vendió"], ["y", "lo", "que", "se", "lavó,"], ["aunque", "no", "estés", "en", "el", "local."]]],
        [46.98, 5.26, [0.1, 0.8, 1.22, 1.3, 1.58, 2.31, 2.52, 2.62, 3.19, 3.32, 3.76, 3.86, 3.97],
          [["Ventas,", "gastos"], ["y", "kilos", "lavados,"], ["desde", "la", "compu,"], ["la", "tablet", "o", "el", "celular."]]],
        [52.54, 7.27, [0.1, 0.41, 1.14, 1.22, 1.75, 2.39, 2.46, 2.66, 3.11, 3.43, 4.86, 5.1, 5.2, 5.84, 5.99],
          [[["LavaManager:", 2]], ["tu", "lavandería", "organizada"], ["y", "tus", "clientes"], ["siempre", "avisados."], ["Pide", "tu", "demostración"], ["por", "WhatsApp."]]],
      ];
      const caps = document.getElementById("caps");
      lines.forEach(([start, dur, times, groups]) => {
        let wi = 0;
        const built = groups.map((g) => {
          const el = document.createElement("div");
          el.className = "cap";
          const pill = document.createElement("div");
          pill.className = "pill";
          el.appendChild(pill);
          const spans = g.map((tok) => {
            const [text, n] = Array.isArray(tok) ? tok : [tok, 1];
            const sp = document.createElement("span");
            sp.textContent = text;
            pill.appendChild(sp);
            pill.appendChild(document.createTextNode(" "));
            const t = start + times[wi];
            wi += n;
            return [sp, t];
          });
          caps.appendChild(el);
          return { el, spans, t0: spans[0][1] - 0.08 };
        });
        built.forEach((b, i) => {
          const end = i + 1 < built.length ? built[i + 1].t0 : start + dur + 0.25;
          tl.fromTo(b.el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, b.t0);
          tl.to(b.el, { opacity: 0, duration: 0.1 }, end - 0.1);
          b.spans.forEach(([sp, t], k) => {
            tl.to(sp, { color: "#4f46e5", duration: 0.08 }, t);
            if (k > 0) tl.to(b.spans[k - 1][0], { color: "#0f172a", duration: 0.08 }, t);
          });
        });
      });

      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
