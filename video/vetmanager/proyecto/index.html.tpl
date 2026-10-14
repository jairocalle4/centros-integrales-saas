<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>VetManager — Promo vertical</title>
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
        --brand: #4361ee;
        --brand-700: #3f37c9;
        --brand-100: #e0e7ff;
        --ink: #0f172a;
        --muted: #64748b;
        --upcoming: #79828e;
        --canvas: #f3f5f9;
        --wa: #25d366;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: var(--canvas); }
      #root {
        position: relative; width: 100%; height: 100%; overflow: hidden;
        font-family: "Inter", ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: var(--canvas);
      }
      .blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; }
      #blob1 { width: 760px; height: 760px; left: -260px; top: -180px; background: #c7d2fe; }
      #blob2 { width: 680px; height: 680px; right: -260px; top: 780px; background: #bae6fd; }
      #blob3 { width: 600px; height: 600px; left: 100px; bottom: -280px; background: #ddd6fe; }

      .logo { display: block; }
      #brand { position: absolute; left: 0; right: 0; top: 96px; display: flex; justify-content: center; align-items: center; gap: 18px; }
      #brand .logo { width: 64px; height: 64px; }
      #brand span { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; }

      /* ── Gancho ── */
      #hook { position: absolute; inset: 0; }
      .mess { position: absolute; border-radius: 22px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, .14); padding: 22px 26px; font-size: 30px; font-weight: 700; display: flex; align-items: center; gap: 16px; }
      #m1 { left: 60px; top: 230px; background: #fef9c3; color: #713f12; }
      #m2 { right: 50px; top: 360px; color: #166534; }
      #m3 { left: 80px; top: 1380px; background: #dcfce7; color: #14532d; }
      #m4 { right: 60px; top: 1560px; background: #fff7ed; color: #9a3412; }
      #m5 { left: 150px; top: 540px; background: #e0f2fe; color: #075985; font-size: 26px; }
      .q { position: absolute; left: 50px; right: 50px; text-align: center; font-size: 88px; line-height: 1.07; font-weight: 900; letter-spacing: -0.035em; }
      #q1 { top: 720px; }
      #q2 { top: 640px; }
      .q .ln { display: block; }
      .q .w { color: var(--upcoming); }
      .q .mark { position: relative; display: inline-block; }
      #strike { position: absolute; left: -6px; right: -6px; top: 54%; height: 14px; border-radius: 8px; background: #ef4444; transform-origin: 0 50%; }
      #money { position: absolute; left: 0; right: 0; top: 1080px; text-align: center; font-size: 200px; font-weight: 900; letter-spacing: -0.04em; color: var(--brand); }
      #hookLogo { position: absolute; left: 0; right: 0; top: 850px; display: flex; justify-content: center; }
      #hookLogo .logo { width: 220px; height: 220px; filter: drop-shadow(0 30px 60px rgba(67, 97, 238, .45)); }

      /* ── Titulares ── */
      .hl { position: absolute; left: 50px; right: 50px; top: 205px; text-align: center; }
      .chip { display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px; border-radius: 999px; background: var(--brand-100); color: var(--brand-700); font-size: 28px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
      .chip.premium { margin-left: 10px; background: linear-gradient(90deg, #f59e0b, #f97316); color: #fff; }
      .hl h2 { margin-top: 22px; font-size: 76px; line-height: 1.06; font-weight: 900; letter-spacing: -0.035em; }
      .hl h2 em { font-style: normal; color: var(--brand); }

      /* ── Ventana de la app ── */
      #card { position: absolute; left: 40px; top: 500px; width: 1000px; height: 916px; border-radius: 34px; overflow: hidden; background: #fff; box-shadow: 0 40px 100px rgba(30, 27, 75, .22), 0 0 0 2px rgba(67, 97, 238, .1); }
      #bar { position: absolute; left: 0; right: 0; top: 0; height: 56px; background: #f1f5f9; display: flex; align-items: center; padding: 0 24px; gap: 10px; border-bottom: 1px solid #e2e8f0; }
      #bar i { width: 14px; height: 14px; border-radius: 50%; background: #cbd5e1; display: block; }
      #bar b { margin-left: 18px; flex: 1; height: 34px; border-radius: 10px; background: #fff; font-size: 20px; font-weight: 600; color: var(--muted); display: flex; align-items: center; padding-left: 16px; }
      #vp { position: absolute; left: 0; top: 56px; width: 1000px; height: 860px; overflow: hidden; background: var(--canvas); }
      .slot { position: absolute; left: 0; top: 0; width: 1000px; height: 860px; }
      .zw { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
      .zw video { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
      .cur { position: absolute; left: 0; top: 0; width: 30px; height: 30px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .35)); }
      .rip { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: rgba(67, 97, 238, .5); opacity: 0; }
      .spot { position: absolute; border-radius: 14px; border: 3px solid var(--brand); box-shadow: 0 0 0 4000px rgba(15, 23, 42, .68); opacity: 0; }

      /* ── Teléfonos ── */
      .phone { position: absolute; border-radius: 64px; background: #0f172a; padding: 16px; box-shadow: 0 50px 110px rgba(15, 23, 42, .35); }
      .phone .screen { position: relative; width: 100%; height: 100%; border-radius: 50px; overflow: hidden; background: #fff; }
      /* Altura explícita (proporción real 780x1688) para que el render no recoloque el cuadro */
      .phone video { position: absolute; left: 0; top: 0; width: 100%; object-fit: cover; object-position: top center; }
      #phoneL video { height: 948px; }
      #phoneS video { height: 559px; }
      #phoneS { left: 770px; top: 850px; width: 280px; height: 590px; border-radius: 44px; padding: 11px; }
      #phoneS .screen { border-radius: 34px; }
      #phoneL { left: 305px; top: 430px; width: 470px; height: 960px; }
      .float { position: absolute; display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 22px; padding: 18px 24px; font-size: 28px; font-weight: 800; box-shadow: 0 20px 50px rgba(15, 23, 42, .15); }
      #f1 { left: 40px; top: 640px; }
      #f2 { right: 40px; top: 1030px; }

      /* ── WhatsApp y regímenes ── */
      #wa { position: absolute; left: 60px; top: 1010px; width: 700px; border-radius: 28px; overflow: hidden; background: #efeae2; box-shadow: 0 30px 80px rgba(15, 23, 42, .3); }
      #wa .top { background: #075e54; color: #fff; padding: 18px 24px; font-size: 26px; font-weight: 800; display: flex; align-items: center; gap: 14px; }
      #wa .msg { margin: 18px; background: #fff; border-radius: 18px; padding: 18px 22px; font-size: 25px; line-height: 1.32; color: #111b21; box-shadow: 0 2px 4px rgba(0, 0, 0, .08); }
      #wa .msg b { font-weight: 800; }
      #wa .tick { display: block; text-align: right; font-size: 20px; color: #53bdeb; margin-top: 6px; }
      #regs { position: absolute; left: 60px; right: 60px; top: 1170px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
      .reg { padding: 18px 30px; border-radius: 20px; background: #fff; font-size: 34px; font-weight: 800; color: var(--ink); box-shadow: 0 16px 40px rgba(15, 23, 42, .16); border: 3px solid var(--brand-100); }
      .reg small { color: var(--brand); font-weight: 800; }

      /* ── Cierre ── */
      #close { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding-top: 230px; }
      #closeLogo { width: 200px; height: 200px; filter: drop-shadow(0 30px 60px rgba(67, 97, 238, .4)); }
      #closeName { margin-top: 32px; font-size: 100px; font-weight: 900; letter-spacing: -0.04em; }
      #closeFor { margin-top: 6px; font-size: 32px; font-weight: 700; color: var(--muted); text-align: center; padding: 0 60px; }
      #closeTag { margin-top: 36px; font-size: 52px; line-height: 1.15; font-weight: 800; text-align: center; letter-spacing: -0.02em; padding: 0 40px; }
      #closeTag em { font-style: normal; color: var(--brand); }
      #cta { margin-top: 50px; padding: 30px 60px; border-radius: 999px; background: var(--brand); color: #fff; font-size: 46px; font-weight: 800; box-shadow: 0 24px 60px rgba(67, 97, 238, .45); }
      .contact { margin-top: 28px; display: flex; align-items: center; gap: 20px; font-size: 50px; font-weight: 800; }
      .contact .ic { width: 76px; height: 76px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      #ctUrl { margin-top: 18px; font-size: 38px; color: var(--brand-700); }
      #ctUrl .ic { width: 64px; height: 64px; background: var(--brand-100); }


      /* ── Capa creativa: tinte por sección, huellas, mascotas, celular del dueño, sello, confeti ── */
      #tint { position: absolute; inset: 0; background: #eef2ff; }
      .paw { position: absolute; left: 0; top: 0; width: 120px; height: 120px; color: #4361ee; opacity: 0; }
      .mascot { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 10px; opacity: 0; }
      .mascot .emo { font-size: 128px; line-height: 1; filter: drop-shadow(0 14px 22px rgba(15, 23, 42, .25)); }
      .mascot .bubble { position: relative; background: #fff; border-radius: 26px; padding: 16px 22px; font-size: 32px; font-weight: 800; color: var(--ink); box-shadow: 0 16px 40px rgba(15, 23, 42, .18); white-space: nowrap; }
      .mascot .bubble::after { content: ""; position: absolute; right: -14px; top: 50%; margin-top: -12px; border: 12px solid transparent; border-left-color: #fff; border-right: 0; }
      #ownerPhone { position: absolute; left: 620px; top: 650px; width: 400px; height: 820px; border-radius: 62px; background: #0f172a; padding: 14px; box-shadow: 0 50px 120px rgba(15, 23, 42, .45); }
      #ownerPhone .lock { position: relative; width: 100%; height: 100%; border-radius: 48px; overflow: hidden; background: linear-gradient(160deg, #4361ee 0%, #7c3aed 55%, #db2777 100%); color: #fff; text-align: center; }
      #ownerPhone .clock { margin-top: 70px; font-size: 96px; font-weight: 300; letter-spacing: -0.02em; }
      #ownerPhone .date { font-size: 24px; font-weight: 600; opacity: .9; }
      #ownerPhone .pet { position: absolute; left: 0; right: 0; bottom: 70px; font-size: 170px; line-height: 1; }
      #notif { position: absolute; left: 14px; right: 14px; top: 300px; border-radius: 26px; padding: 16px 18px; background: rgba(255, 255, 255, .92); color: #111827; text-align: left; box-shadow: 0 10px 30px rgba(0, 0, 0, .25); }
      #notif .row { display: flex; align-items: center; gap: 10px; font-size: 19px; color: #6b7280; font-weight: 600; }
      #notif .app { width: 34px; height: 34px; border-radius: 9px; background: var(--wa); display: flex; align-items: center; justify-content: center; }
      #notif .ttl { margin-top: 8px; font-size: 22px; font-weight: 800; }
      #notif .body { margin-top: 4px; font-size: 20px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
      #premium { position: absolute; left: 50px; top: 1120px; padding: 26px 40px; border-radius: 26px; background: linear-gradient(120deg, #f59e0b, #f97316 55%, #fbbf24); color: #fff; font-size: 52px; font-weight: 900; letter-spacing: .02em; box-shadow: 0 24px 60px rgba(249, 115, 22, .45); overflow: hidden; }
      #premium small { display: block; font-size: 24px; font-weight: 700; letter-spacing: 0; opacity: .95; }
      #premium .shine { position: absolute; top: -20%; left: 0; width: 60px; height: 140%; background: rgba(255, 255, 255, .55); filter: blur(6px); }
      .cf { position: absolute; left: 0; top: 0; width: 16px; height: 26px; border-radius: 4px; opacity: 0; }
      .coin { position: absolute; top: 0; font-size: 84px; opacity: 0; }
      #pupHook { position: absolute; left: 0; right: 0; top: 1200px; text-align: center; font-size: 170px; opacity: 0; }
      #pupHook span { display: inline-block; }
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
    <div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="1080" data-height="1920">
      <div id="tint"></div>
      <div class="blob" id="blob1" data-layout-allow-overflow></div>
      <div class="blob" id="blob2" data-layout-allow-overflow></div>
      <div class="blob" id="blob3" data-layout-allow-overflow></div>

      <!-- ── Narración (voz es-EC Andrea) ── -->
      <audio id="vo1" src="assets/voz/01-gancho.mp3" data-start="0.30" data-duration="7.58" data-track-index="10"></audio>
      <audio id="vo2" src="assets/voz/02-organiza.mp3" data-start="8.18" data-duration="3.82" data-track-index="11"></audio>
      <audio id="vo3" src="assets/voz/03-historia.mp3" data-start="12.30" data-duration="6.29" data-track-index="10"></audio>
      <audio id="vo4" src="assets/voz/04-vacunas.mp3" data-start="18.89" data-duration="4.08" data-track-index="11"></audio>
      <audio id="vo5" src="assets/voz/05-bano.mp3" data-start="23.27" data-duration="5.26" data-track-index="10"></audio>
      <audio id="vo6" src="assets/voz/06-pos.mp3" data-start="28.83" data-duration="7.58" data-track-index="11"></audio>
      <audio id="vo7" src="assets/voz/07-inventario.mp3" data-start="36.71" data-duration="5.40" data-track-index="10"></audio>
      <audio id="vo8" src="assets/voz/08-caja.mp3" data-start="42.41" data-duration="3.00" data-track-index="11"></audio>
      <audio id="vo9" src="assets/voz/09-reportes.mp3" data-start="45.71" data-duration="5.78" data-track-index="10"></audio>
      <audio id="vo10" src="assets/voz/10-cierre.mp3" data-start="51.79" data-duration="6.79" data-track-index="11"></audio>

      <!-- ── 0 · Gancho ── -->
      <section id="hook" class="clip" data-start="0" data-duration="8.40" data-track-index="1">
        <div class="mess" id="m1">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h7M8 12h7M8 16h4"/></svg>
          Cuaderno de citas
        </div>
        <div class="mess" id="m2">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
          inventario_FINAL.xlsx
        </div>
        <div class="mess" id="m5">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0369a1" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>
          Carné de vacunas en papel
        </div>
        <div class="mess" id="m3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#16a34a"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>
          “¿Ya está listo mi perrito?”
        </div>
        <div class="mess" id="m4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/></svg>
          Factura a mano N° 104
        </div>
        <h1 class="q" id="q1">
          <span class="ln"><span class="w">¿Tu</span> <span class="w">veterinaria</span> <span class="w">o</span></span>
          <span class="ln"><span class="w">peluquería</span> <span class="w">canina</span></span>
          <span class="ln"><span class="w">todavía</span> <span class="w">vive</span> <span class="w">entre</span></span>
          <span class="ln"><span class="mark"><span class="w">cuadernos</span> <span class="w">y</span> <span class="w">Excel?</span><span id="strike"></span></span></span>
        </h1>
        <h1 class="q" id="q2">
          <span class="ln"><span class="w">¿Y</span> <span class="w">sabes</span> <span class="w">cuánto</span></span>
          <span class="ln"><span class="w">ganas</span> <span class="w">de</span> <span class="w">verdad</span></span>
          <span class="ln"><span class="w">cada</span> <span class="w">mes?</span></span>
        </h1>
        <div id="money">$ ¿?</div>
        <div id="pupHook"><span>🐶</span></div>
        <div class="coin" id="coin1" style="left: 120px">💵</div><div class="coin" id="coin2" style="left: 300px">💵</div>
        <div class="coin" id="coin3" style="left: 700px">💵</div><div class="coin" id="coin4" style="left: 880px">💵</div>
        <div id="hookLogo"><img class="logo" src="assets/img/logo.svg" alt="" /></div>
      </section>

      <div id="brand"><img class="logo" src="assets/img/logo.svg" alt="" /><span>VetManager</span></div>

      <!-- ── Titulares de beneficio ── -->
      <div class="hl clip" id="hl1" data-start="8.10" data-duration="4.20" data-track-index="2"><div class="chip">Todo en un solo lugar</div><h2>Tu clínica, <em>organizada</em></h2></div>
      <div class="hl clip" id="hl2" data-start="12.30" data-duration="6.59" data-track-index="2"><div class="chip">Historia clínica</div><h2>Su expediente <em>completo</em></h2></div>
      <div class="hl clip" id="hl3" data-start="18.89" data-duration="4.38" data-track-index="2"><div class="chip">Vacunas</div><h2>Recordatorios <em>a tiempo</em></h2></div>
      <div class="hl clip" id="hl4" data-start="23.27" data-duration="5.56" data-track-index="2"><div class="chip">WhatsApp automático</div><div class="chip premium">Plan Premium</div><h2>Avisa <em>sin escribir</em></h2></div>
      <div class="hl clip" id="hl5" data-start="28.83" data-duration="7.88" data-track-index="2"><div class="chip">Punto de venta · SRI</div><h2>Vende y factura <em>al SRI</em></h2></div>
      <div class="hl clip" id="hl6" data-start="36.71" data-duration="5.70" data-track-index="2"><div class="chip">Inventario</div><h2>Stock <em>bajo control</em></h2></div>
      <div class="hl clip" id="hl7" data-start="42.41" data-duration="3.30" data-track-index="2"><div class="chip">Caja · Gastos</div><h2>Tu caja, <em>cuadrada</em></h2></div>
      <div class="hl clip" id="hl8" data-start="45.71" data-duration="5.90" data-track-index="2"><div class="chip">Reportes</div><h2>Sabes cuánto <em>ganas</em></h2></div>

      <!-- ── Ventana de la app (zoom + cursor dibujado a 30 fps) ── -->
      <div id="card">
        <div id="bar"><i></i><i></i><i></i><b>vetmanager-saas.pages.dev/app</b></div>
        <div id="vp" data-layout-allow-overflow>
          <!--@VIDEOS@-->
        </div>
      </div>

      <!-- Teléfono pequeño junto al panel -->
      <div class="phone" id="phoneS"><div class="screen" data-layout-allow-overflow>
        <video id="v-ms" src="assets/clips/movil-agenda.mp4" muted playsinline data-start="9.00" data-duration="3.30" data-media-start="0.1" data-track-index="4"></video>
      </div></div>

      <!-- Celular del dueño: recibe el WhatsApp automático (texto real de la app) -->
      <div id="ownerPhone"><div class="lock">
        <div class="clock">3:42</div><div class="date">miércoles, 14 de octubre</div>
        <div id="notif">
          <div class="row"><div class="app"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg></div>WHATSAPP · ahora</div>
          <div class="ttl">VetAnimals</div>
          <div class="body">🐾 ¡HOLA, CARLOS ZAMBRANO! ✨ Te tenemos una excelente noticia: tu consentido(a) Canela ya terminó su servicio de Baño y corte en VetAnimals. 📍 ¡YA PUEDES PASAR A RETIRARLO(A)!</div>
        </div>
        <div class="pet">🐩</div>
      </div></div>
      <div id="premium">⭐ PLAN PREMIUM<small>WhatsApp automático incluido</small><div class="shine"></div></div>

      <!-- Regímenes tributarios soportados -->
      <div id="regs">
        <div class="reg"><small>✓</small> RIMPE Negocio Popular</div>
        <div class="reg"><small>✓</small> RIMPE Emprendedor</div>
        <div class="reg"><small>✓</small> Régimen General</div>
      </div>

      <!-- Teléfono grande: desde el celular -->
      <div class="phone" id="phoneL"><div class="screen" data-layout-allow-overflow>
        <video id="v-ml" src="assets/clips/movil-panel.mp4" muted playsinline data-start="48.90" data-duration="2.95" data-media-start="2.2" data-track-index="4"></video>
      </div></div>
      <div class="float" id="f1">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2.2"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        Computadora
      </div>
      <div class="float" id="f2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2.2"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
        Celular
      </div>

      <!-- ── Cierre ── -->
      <section id="close" class="clip" data-start="51.60" data-duration="8.40" data-track-index="1">
        <div class="closePet" id="cpL">🐶</div><div class="closePet" id="cpR">🐱</div>
        <img id="closeLogo" src="assets/img/logo.svg" alt="" />
        <div id="closeName">VetManager</div>
        <div id="closeFor">Para veterinarias, peluquerías caninas y pet shops</div>
        <div id="closeTag">Tu clínica en orden,<em> más tiempo para tus pacientes.</em></div>
        <div id="cta">Pide tu demostración</div>
        <div class="contact" id="ctWa">
          <div class="ic" style="background: var(--wa)">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.1 13.9c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.1 0 .3 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.2.4-.3.4c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.7 1.1 1.9 1.2.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.2z"/></svg>
          </div>
          099 169 3863
        </div>
        <div class="contact" id="ctUrl">
          <div class="ic"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg></div>
          vetmanager-saas.pages.dev/app
        </div>
      </section>

      <div class="mascot" id="ma"><div class="bubble">¡Todo en orden!</div><div class="emo">🐶</div></div>
      <div class="mascot" id="mb"><div class="bubble">¡Mi historial! 📋</div><div class="emo">🐕</div></div>
      <div class="mascot" id="mc"><div class="bubble">¿Me toca vacuna? 💉</div><div class="emo">🐱</div></div>
      <div class="mascot" id="md"><div class="bubble">¡Ya estoy lista! ✨</div><div class="emo">🐩</div></div>
      <div class="mascot" id="me"><div class="bubble">¡Factura lista! ✅</div><div class="emo">🧾</div></div>
      <div class="mascot" id="mf"><div class="bubble">¡Que no falte mi comida!</div><div class="emo">🐈</div></div>
      <div class="mascot" id="mg"><div class="bubble">¡Cuadra al centavo!</div><div class="emo">💰</div></div>
      <div class="mascot" id="mh"><div class="bubble">¡Ganamos! 🎉</div><div class="emo">🐶</div></div>
      <svg class="paw" id="pw0" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <svg class="paw" id="pw1" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <svg class="paw" id="pw2" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <svg class="paw" id="pw3" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <svg class="paw" id="pw4" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <svg class="paw" id="pw5" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <svg class="paw" id="pw6" viewBox="0 0 512 512"><g fill="currentColor"><path d="M256 380c-48 0-85-32-85-69 0-27 27-48 51-48 11 0 24 5 34 13 10-8 23-13 34-13 24 0 51 21 51 48 0 37-37 69-85 69z"/><ellipse cx="176" cy="235" rx="27" ry="37" transform="rotate(-18 176 235)"/><ellipse cx="230" cy="198" rx="27" ry="40" transform="rotate(-6 230 198)"/><ellipse cx="282" cy="198" rx="27" ry="40" transform="rotate(6 282 198)"/><ellipse cx="336" cy="235" rx="27" ry="37" transform="rotate(18 336 235)"/></g></svg>
      <div id="confetti"><div class="cf" id="cf0"></div><div class="cf" id="cf1"></div><div class="cf" id="cf2"></div><div class="cf" id="cf3"></div><div class="cf" id="cf4"></div><div class="cf" id="cf5"></div><div class="cf" id="cf6"></div><div class="cf" id="cf7"></div><div class="cf" id="cf8"></div><div class="cf" id="cf9"></div><div class="cf" id="cf10"></div><div class="cf" id="cf11"></div><div class="cf" id="cf12"></div><div class="cf" id="cf13"></div><div class="cf" id="cf14"></div><div class="cf" id="cf15"></div><div class="cf" id="cf16"></div><div class="cf" id="cf17"></div><div class="cf" id="cf18"></div><div class="cf" id="cf19"></div><div class="cf" id="cf20"></div><div class="cf" id="cf21"></div><div class="cf" id="cf22"></div><div class="cf" id="cf23"></div><div class="cf" id="cf24"></div><div class="cf" id="cf25"></div></div>
      <div id="caps"></div>
    </div>

    <script>
      const SHOTS = /*@SHOTS@*/[];
      const tl = gsap.timeline({ paused: true });

      // ── Fondo vivo (determinista) ──
      tl.fromTo("#blob1", { x: 0, y: 0 }, { x: 140, y: 100, duration: 60, ease: "sine.inOut" }, 0);
      tl.fromTo("#blob2", { x: 0, y: 0 }, { x: -160, y: -140, duration: 60, ease: "sine.inOut" }, 0);
      tl.fromTo("#blob3", { x: 0, y: 0 }, { x: 100, y: -80, duration: 60, ease: "sine.inOut" }, 0);

      // ── Gancho ──
      const mess = ["#m1", "#m2", "#m5", "#m3", "#m4"];
      const rot = [-7, 6, -4, 5, -6];
      mess.forEach((id, i) => {
        tl.fromTo(id, { opacity: 0, scale: 0.6, rotation: rot[i] * 3, y: 40 },
          { opacity: 1, scale: 1, rotation: rot[i], y: 0, duration: 0.5, ease: "back.out(1.8)" }, 0.15 + i * 0.3);
        tl.to(id, { rotation: rot[i] * -0.6, duration: 0.18, repeat: 5, yoyo: true, ease: "sine.inOut" }, 2.6 + i * 0.05);
        tl.to(id, { x: i % 2 ? 420 : -420, scale: 0.4, opacity: 0, rotation: rot[i] * 4, duration: 0.45, ease: "power3.in" }, 4.55 + i * 0.04);
      });
      const L1 = [0.1, 0.2, 0.84, 0.91, 1.42, 1.81, 2.25, 2.51, 2.74, 3.32, 3.43, 4.6, 4.69, 5.06, 5.35, 5.67, 5.74, 6.11, 6.38];
      const qw = [...document.querySelectorAll("#q1 .w"), ...document.querySelectorAll("#q2 .w")];
      tl.fromTo("#q1", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.1);
      qw.forEach((w, i) => tl.to(w, { color: i >= 8 && i <= 10 ? "#ef4444" : "#0f172a", duration: 0.12 }, 0.3 + L1[i]));
      tl.fromTo("#strike", { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.out" }, 3.9);
      tl.to("#q1", { opacity: 0, y: -60, duration: 0.3, ease: "power2.in" }, 4.55);
      tl.fromTo("#q2", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 4.75);
      tl.fromTo("#money", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 5.6);
      tl.to("#money", { rotation: -4, duration: 0.15, repeat: 7, yoyo: true, ease: "sine.inOut" }, 6.2);
      tl.to(["#q2", "#money"], { opacity: 0, scale: 0.9, duration: 0.3, ease: "power2.in" }, 7.25);
      tl.fromTo("#hookLogo .logo", { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.4, ease: "back.out(2)" }, 7.4);
      tl.to("#hookLogo .logo", { scale: 0.29, y: -832, x: -124, duration: 0.4, ease: "power3.inOut" }, 7.85);

      // ── Marca superior ──
      tl.set("#brand", { opacity: 0 }, 0);
      tl.to("#brand", { opacity: 1, duration: 0.2 }, 8.2);
      tl.to("#brand", { opacity: 0, duration: 0.3 }, 51.5);

      // ── Titulares ──
      document.querySelectorAll(".hl").forEach((el) => {
        const s = parseFloat(el.dataset.start);
        tl.fromTo(el.querySelectorAll(".chip"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.08, ease: "power3.out" }, s + 0.02);
        tl.fromTo(el.querySelector("h2"), { opacity: 0, y: 36, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.45, ease: "power3.out" }, s + 0.08);
      });

      // ── Ventana: aparición, tomas con zoom, cursor y salida ──
      const VW = 1000;
      const R = ([rx, ry, rw]) => { const s = VW / rw; return { x: -rx * s, y: -ry * s, scale: s }; };
      tl.set("#card", { opacity: 0 }, 0);
      tl.fromTo("#card", { opacity: 0, y: 90, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" }, 8.0);
      SHOTS.forEach((sh, i) => {
        const slot = `#s-${sh.id}`, zw = `#z-${sh.id}`;
        const end = sh.start + sh.dur;
        tl.set(slot, { opacity: 0 }, 0);
        // Transición "barrido" con desenfoque de movimiento al entrar cada toma
        if (i === 0) tl.set(slot, { opacity: 1 }, sh.start);
        else tl.fromTo(slot, { opacity: 0, x: 180, filter: "blur(12px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.32, ease: "power3.out" }, sh.start);
        tl.set(slot, { opacity: 0 }, end);
        // Zoom / paneo de cámara
        const [m0, m1] = sh.move || [0.15, sh.dur - 0.1];
        tl.set(zw, { transformOrigin: "0 0", ...R(sh.frm) }, 0);
        tl.to(zw, { ...R(sh.to), duration: m1 - m0, ease: "power2.inOut" }, sh.start + m0);
        // Foco: oscurece todo menos la fila importante
        if (sh.spot) {
          const [x, y, w, h] = sh.spot;
          tl.set(`${slot} .spot`, { left: x - 8, top: y - 6, width: w + 16, height: h + 12 }, 0);
          tl.fromTo(`${slot} .spot`, { opacity: 0 }, { opacity: 1, duration: 0.4 }, sh.start + Math.min(0.9, sh.dur * 0.35));
        }
        // Cursor a 30 fps desde el registro del grabador
        const cur = `${slot} .cur`, rip = `${slot} .rip`;
        if (sh.pts.length === 0) tl.set(cur, { opacity: 0 }, 0);
        // 10 puntos por segundo, interpolados linealmente (movimiento continuo)
        const pts = sh.pts.filter((p, k, a) => k === 0 || k === a.length - 1 || p[0] - a[k - 1][0] >= 0.0);
        let lastKept = null;
        pts.forEach(([t, x, y], k) => {
          if (k === 0) { tl.set(cur, { x: x - 5, y: y - 3 }, t); lastKept = t; return; }
          if (t - lastKept < 0.1 && k !== pts.length - 1) return;
          tl.to(cur, { x: x - 5, y: y - 3, duration: t - lastKept, ease: "none" }, lastKept);
          lastKept = t;
        });
        sh.clicks.forEach((t) => {
          const last = sh.pts.filter((p) => p[0] <= t).pop() || sh.pts[0];
          tl.set(rip, { x: last[1], y: last[2] }, t);
          tl.fromTo(rip, { scale: 0.4, opacity: 0.85 }, { scale: 4.5, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, t);
        });
      });
      tl.to("#card", { opacity: 0, y: -60, scale: 0.94, duration: 0.35, ease: "power2.in" }, 48.6);

      // ── Teléfono pequeño (agenda en el celular) ──
      tl.set("#phoneS", { opacity: 0 }, 0);
      tl.fromTo("#phoneS", { opacity: 0, x: 120, rotation: 8 }, { opacity: 1, x: 0, rotation: 3, duration: 0.5, ease: "back.out(1.6)" }, 9.0);
      tl.to("#phoneS", { opacity: 0, x: 120, duration: 0.3, ease: "power2.in" }, 12.0);

      // ── Celular del dueño + notificación (resorte) + sello Premium ──
      tl.set(["#ownerPhone", "#premium"], { opacity: 0 }, 0);
      tl.fromTo("#ownerPhone", { opacity: 0, x: 260, rotation: 10 }, { opacity: 1, x: 0, rotation: 4, duration: 0.55, ease: "power3.out" }, 25.55);
      tl.fromTo("#notif", { y: -340, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "elastic.out(1, 0.55)" }, 26.15);
      tl.fromTo("#ownerPhone .pet", { y: 0 }, { y: -18, duration: 0.3, repeat: 7, yoyo: true, ease: "sine.inOut" }, 26.4);
      tl.to("#ownerPhone", { opacity: 0, x: 220, duration: 0.3, ease: "power2.in" }, 28.55);
      tl.fromTo("#premium", { opacity: 0, scale: 0.6, rotation: -14 }, { opacity: 1, scale: 1, rotation: -6, duration: 0.6, ease: "back.out(2.2)" }, 24.2);
      tl.fromTo("#premium .shine", { x: -80 }, { x: 560, duration: 0.7, ease: "power2.inOut", repeat: 2, repeatDelay: 0.6 }, 24.8);
      tl.to("#premium", { opacity: 0, scale: 0.8, duration: 0.3, ease: "power2.in" }, 28.5);

      // ── Regímenes ──
      tl.set("#regs .reg", { opacity: 0 }, 0);
      tl.fromTo("#regs .reg", { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.18, ease: "back.out(1.6)" }, 32.55);
      tl.to("#regs .reg", { opacity: 0, x: 80, duration: 0.25, stagger: 0.05, ease: "power2.in" }, 34.05);

      // ── Teléfono grande ──
      tl.set(["#phoneL", "#f1", "#f2"], { opacity: 0 }, 0);
      tl.fromTo("#phoneL", { opacity: 0, y: 160 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 48.85);
      tl.fromTo("#f1", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.4, ease: "back.out(1.6)" }, 49.35);
      tl.fromTo("#f2", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.4, ease: "back.out(1.6)" }, 50.0);
      tl.to(["#phoneL", "#f1", "#f2", "#hl8 .chip", "#hl8 h2"], { opacity: 0, y: -40, duration: 0.3, ease: "power2.in" }, 51.3);

      // ── Cierre ──
      tl.fromTo("#closeLogo", { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.55, ease: "back.out(2)" }, 51.7);
      tl.fromTo("#closeName", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 51.85);
      tl.fromTo("#closeFor", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 52.2);
      tl.fromTo("#closeTag", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 52.9);
      tl.fromTo("#ctWa", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 54.6);
      tl.fromTo("#ctUrl", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 54.9);
      tl.fromTo("#cta", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, 56.6);
      tl.to("#cta", { scale: 1.06, duration: 0.4, repeat: 5, yoyo: true, ease: "sine.inOut" }, 57.1);


      // ── Tinte de fondo por sección ──
      [[0, "#eef2ff"], [8.18, "#eaf2ff"], [12.30, "#ecfdf5"], [18.89, "#f0f9ff"], [23.27, "#fdf2f8"], [28.83, "#f5f3ff"], [36.71, "#fff7ed"], [42.41, "#fefce8"], [45.71, "#eef2ff"], [51.6, "#eef2ff"]]
        .forEach(([t, c], i) => (i === 0 ? tl.set("#tint", { backgroundColor: c }, 0) : tl.to("#tint", { backgroundColor: c, duration: 0.5, ease: "sine.inOut" }, t - 0.2)));

      // ── Huellitas que cruzan la pantalla en cada cambio de sección ──
      const paws = [...document.querySelectorAll(".paw")];
      tl.set(paws, { opacity: 0 }, 0);
      [12.30, 18.89, 23.27, 28.83, 36.71, 42.41, 45.71].forEach((T, n) => {
        const dir = n % 2 ? -1 : 1;
        paws.forEach((pw, k) => {
          const x = dir > 0 ? -60 + k * 175 : 1050 - k * 175;
          const y = 1360 - k * 120 + (k % 2 ? 40 : -40);
          tl.set(pw, { x, y, rotation: dir * 35 + (k % 2 ? 12 : -12), scale: 0.6 }, T - 0.5);
          tl.to(pw, { opacity: 0.85, scale: 1, duration: 0.12, ease: "back.out(3)" }, T - 0.5 + k * 0.07);
          tl.to(pw, { opacity: 0, duration: 0.25 }, T - 0.5 + k * 0.07 + 0.35);
        });
      });

      // ── Mascotas con globito por sección ──
      const MASC = [["#ma", 8.6, 12.0], ["#mb", 12.7, 18.6], ["#mc", 19.3, 22.95], ["#md", 23.7, 25.4], ["#me", 34.55, 36.45], ["#mf", 37.2, 42.15], ["#mg", 42.75, 45.45], ["#mh", 46.3, 48.4]];
      MASC.forEach(([id, a, b], k) => {
        tl.set(id, { x: 420, y: 418, opacity: 0 }, 0);
        tl.fromTo(id, { opacity: 0, scale: 0.4, y: 440 }, { opacity: 1, scale: 1, y: 418, duration: 0.5, ease: "back.out(2)" }, a);
        tl.to(`${id} .emo`, { rotation: k % 2 ? 8 : -8, duration: 0.35, repeat: Math.max(1, Math.floor((b - a - 0.9) / 0.35)), yoyo: true, ease: "sine.inOut" }, a + 0.5);
        tl.to(id, { opacity: 0, scale: 0.6, duration: 0.25, ease: "power2.in" }, b);
      });

      // ── Confeti determinista ──
      const CF = [...document.querySelectorAll(".cf")];
      const CFC = ["#4361ee", "#f59e0b", "#22c55e", "#ec4899", "#38bdf8", "#a855f7"];
      CF.forEach((el, i) => tl.set(el, { backgroundColor: CFC[i % CFC.length] }, 0));
      const burst = (t, cx, cy) => {
        CF.forEach((el, i) => {
          const ang = i * 0.83, dist = 180 + (i % 5) * 60;
          tl.set(el, { x: cx, y: cy, rotation: 0, opacity: 0 }, t - 0.01);
          tl.to(el, { opacity: 1, x: cx + Math.cos(ang) * dist, y: cy - 160 - Math.sin(ang) * dist * 0.8, rotation: 180 + i * 37, duration: 0.6, ease: "power2.out" }, t + i * 0.01);
          tl.to(el, { y: `+=${420 + (i % 4) * 60}`, rotation: `+=${200 + i * 11}`, opacity: 0, duration: 1.0, ease: "power1.in" }, t + 0.6 + i * 0.01);
        });
      };
      burst(34.7, 540, 760);
      burst(42.95, 540, 900);
      burst(56.75, 540, 1060);

      // ── Gancho: perrito confundido y monedas ──
      tl.fromTo("#pupHook", { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.45, ease: "back.out(2)" }, 1.4);
      tl.to("#pupHook span", { rotation: 14, duration: 0.3, repeat: 7, yoyo: true, ease: "sine.inOut" }, 1.9);
      tl.to("#pupHook", { opacity: 0, duration: 0.25 }, 4.5);
      ["#coin1", "#coin2", "#coin3", "#coin4"].forEach((c, i) => {
        tl.fromTo(c, { opacity: 0, y: -150, rotation: 0 }, { opacity: 1, y: 1500 + i * 60, rotation: 300 + i * 70, duration: 1.6, ease: "power1.in" }, 5.4 + i * 0.25);
      });

      // ── Cierre: mascotas saltando ──
      tl.fromTo(["#cpL", "#cpR"], { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.15, ease: "back.out(2.2)" }, 52.0);
      tl.to("#cpL", { y: -40, duration: 0.35, repeat: 9, yoyo: true, ease: "sine.inOut" }, 52.6);
      tl.to("#cpR", { y: -40, duration: 0.35, repeat: 9, yoyo: true, ease: "sine.inOut" }, 52.8);

      // ── Subtítulos con resaltado por palabra ──
      // [inicio, tiempos por palabra de la voz, grupos]; ["texto", n] consume n palabras.
      const lines = [
        [8.18, 3.82, [0.1, 0.34, 0.68, 1.17, 1.48, 1.61, 2.11, 2.23, 2.36, 2.65],
          [[["VetManager", 2], "organiza"], ["toda", "tu", "clínica"], ["en", "un", "solo", "lugar."]]],
        [12.30, 6.29, [0.1, 0.31, 0.75, 0.96, 1.08, 1.5, 1.57, 1.99, 2.7, 3.62, 4.1, 4.8, 4.87],
          [["Cada", "mascota", "tiene", "su", "ficha"], ["e", "historia", "clínica:"], ["consultas,", "peso,", "diagnóstico"], ["y", "vacunas."]]],
        [18.89, 4.08, [0.1, 0.45, 0.55, 0.91, 1.48, 1.54, 1.66, 1.75, 2.26, 2.37, 2.66, 2.83],
          [["Sabes", "qué", "vacuna", "toca,"], ["y", "se", "la", "recuerdas"], ["al", "dueño", "por", "WhatsApp."]]],
        [23.27, 5.26, [0.1, 0.2, 0.4, 0.48, 0.72, 1.4, 1.56, 1.82, 2.14, 2.27, 2.57, 3.17, 3.37, 3.79, 3.84, 3.96],
          [["Y", "cuando", "el", "baño", "termina,"], ["el", "dueño", "recibe"], ["un", "WhatsApp", "automático"], ["para", "retirar", "a", "su", "mascota."]]],
        [28.83, 7.58, [0.1, 0.42, 0.56, 0.85, 0.95, 1.31, 1.4, 1.76, 1.81, 2.27, 2.39, 2.79, 3.3, 3.7, 3.96, 4.26, 4.34, 4.8, 5.53, 5.65, 5.87, 6.0, 6.44],
          [["Vendes", "con", "lector"], ["de", "código", "de", "barras"], ["y", "facturas", "al", ["SRI,", 3]], ["seas", "RIMPE", "o", ["Régimen General:", 2]], ["el", "IVA", "se", "calcula", "solo."]]],
        [36.71, 5.40, [0.1, 0.32, 0.61, 1.07, 1.16, 1.9, 2.02, 2.09, 2.4, 2.56, 2.88, 3.3, 3.41, 3.51, 3.61, 3.7, 3.95, 4.12],
          [["Cada", "venta", "descuenta"], ["tu", "inventario,"], ["y", "te", "avisa", "del", "stock", "bajo"], ["y", "de", "lo", "que", "está", "por", "caducar."]]],
        [42.41, 3.00, [0.1, 0.46, 0.57, 0.91, 0.99, 1.51, 1.67],
          [["Cuadras", "tu", "caja"], ["y", "registras", "tus", "gastos."]]],
        [45.71, 5.78, [0.1, 0.2, 0.29, 0.72, 0.87, 1.03, 1.77, 1.88, 2.26, 2.36, 2.49, 3.0, 3.61, 3.83, 3.93, 4.26, 4.38, 4.48],
          [["Y", "en", "reportes"], ["ves", "tus", "ingresos,"], ["tu", "margen", "y", "tu", "utilidad", "real,"], ["desde", "la", "compu", "o", "el", "celular."]]],
        [51.79, 6.79, [0.1, 0.37, 1.15, 1.3, 1.73, 1.83, 2.4, 2.46, 2.73, 3.04, 3.22, 3.41, 4.86, 5.15, 5.26],
          [[["VetManager:", 2]], ["tu", "clínica", "en", "orden,"], ["y", "más", "tiempo", "para", "tus", "pacientes."], ["Pide", "tu", "demostración."]]],
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
            tl.to(sp, { color: "#4361ee", duration: 0.08 }, t);
            if (k > 0) tl.to(b.spans[k - 1][0], { color: "#0f172a", duration: 0.08 }, t);
          });
        });
      });

      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
