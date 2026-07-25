// GENERATED from the Claude Design project "Home.dc.html" (Home page redesign).
// The painted night backdrop and the road layer, verbatim from the design doc.
// Do not restyle here — change it in the design project and re-import, so the
// two never drift. Slots (<!--slot:name-->) are filled at runtime by index.js
// with Graphics-preset-scaled particle counts.

export const BACKDROP_HTML = `      <div data-photo="1" style="position:absolute; inset:0; background-size:cover; background-position:center; opacity:0"></div>
      <div data-sky="1" style="position:absolute; inset:0; background:linear-gradient(180deg,#01020a 0%,#03071a 13%,#061031 26%,#0a1842 39%,#102150 52%,#17284f 63%,#1d2b4a 73%,#222c42 84%,#242a38 94%)"></div>

      <div data-stars="1" style="position:absolute; left:0; top:0; width:1440px; height:560px; opacity:1; pointer-events:none">
        <!--slot:stars-->
        <!--slot:sparkles-->
        <div style="position:absolute; left:180px; top:96px; width:130px; height:2px; transform-origin:left center; animation:mrShoot 19s linear 4s infinite; pointer-events:none">
          <div style="position:absolute; left:0; top:0; width:100%; height:2px; border-radius:2px; background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(214,230,255,.55) 55%,#ffffff 100%); transform:rotate(23deg); transform-origin:left center; box-shadow:0 0 8px 1px rgba(200,222,255,.5)"></div>
        </div>
        <div style="position:absolute; left:820px; top:58px; width:168px; height:2px; transform-origin:left center; animation:mrShoot 26s linear 13s infinite; pointer-events:none">
          <div style="position:absolute; left:0; top:0; width:100%; height:2px; border-radius:2px; background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(214,230,255,.55) 55%,#ffffff 100%); transform:rotate(23deg); transform-origin:left center; box-shadow:0 0 8px 1px rgba(200,222,255,.5)"></div>
        </div>
        <div style="position:absolute; left:1090px; top:152px; width:112px; height:2px; transform-origin:left center; animation:mrShoot 33s linear 22s infinite; pointer-events:none">
          <div style="position:absolute; left:0; top:0; width:100%; height:2px; border-radius:2px; background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(214,230,255,.55) 55%,#ffffff 100%); transform:rotate(23deg); transform-origin:left center; box-shadow:0 0 8px 1px rgba(200,222,255,.5)"></div>
        </div>
      </div>

      <div data-lumglow="1" style="position:absolute; left:1200px; top:414px; width:640px; height:640px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle,rgba(196,218,255,.34) 0%,rgba(150,186,255,.12) 30%,rgba(140,178,255,0) 64%); pointer-events:none"></div>
      <div data-lumring="1" style="position:absolute; left:1200px; top:414px; width:250px; height:250px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle,rgba(226,238,255,.22) 0%,rgba(226,238,255,.1) 54%,rgba(226,238,255,0) 68%); animation:mrPulse 11s ease-in-out infinite; pointer-events:none"></div>
      <div data-lum="1" style="position:absolute; left:1200px; top:414px; width:128px; height:128px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle at 38% 34%,#ffffff 0%,#f7faff 44%,#dfe8ff 62%,rgba(223,232,255,.3) 71%,rgba(223,232,255,0) 79%); animation:mrGlow 10s ease-in-out infinite; pointer-events:none; overflow:hidden">
        <div style="position:absolute; left:22%; top:26%; width:34%; height:30%; border-radius:50%; background:rgba(176,196,236,.16); filter:blur(6px)"></div>
        <div style="position:absolute; left:52%; top:46%; width:26%; height:24%; border-radius:50%; background:rgba(176,196,236,.13); filter:blur(6px)"></div>
        <div style="position:absolute; left:34%; top:62%; width:20%; height:16%; border-radius:50%; background:rgba(176,196,236,.1); filter:blur(5px)"></div>
        <div style="position:absolute; left:60%; top:22%; width:12%; height:11%; border-radius:50%; background:rgba(176,196,236,.12); filter:blur(4px)"></div>
      </div>

      <div data-par="0.04" style="position:absolute; left:0; top:326px; width:6400px; height:210px; pointer-events:none">
        <div style="position:absolute; left:120px; top:40px; width:520px; height:84px; opacity:0.2; filter:blur(35px); animation:mrDrift 96s ease-in-out 0s infinite alternate">
          <div style="position:absolute; left:0; top:23.520000000000003px; width:270.40000000000003px; height:52.08px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:156px; top:0; width:239.20000000000002px; height:67.2px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:301.59999999999997px; top:18.48px; width:228.8px; height:55.440000000000005px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:62.4px; top:42px; width:416px; height:36.96px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:760px; top:96px; width:380px; height:62px; opacity:0.14; filter:blur(26px); animation:mrDrift 118s ease-in-out 3s infinite alternate">
          <div style="position:absolute; left:0; top:17.360000000000003px; width:197.6px; height:38.44px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:114px; top:0; width:174.8px; height:49.6px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:220.39999999999998px; top:13.64px; width:167.2px; height:40.92px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:45.6px; top:31px; width:304px; height:27.28px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:1180px; top:30px; width:620px; height:96px; opacity:0.11; filter:blur(40px); animation:mrDrift 104s ease-in-out 6s infinite alternate">
          <div style="position:absolute; left:0; top:26.880000000000003px; width:322.40000000000003px; height:59.519999999999996px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:186px; top:0; width:285.2px; height:76.80000000000001px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:359.59999999999997px; top:21.12px; width:272.8px; height:63.36px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:74.39999999999999px; top:48px; width:496px; height:42.24px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:2080px; top:84px; width:460px; height:72px; opacity:0.18; filter:blur(30px); animation:mrDrift 92s ease-in-out 2s infinite alternate">
          <div style="position:absolute; left:0; top:20.160000000000004px; width:239.20000000000002px; height:44.64px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:138px; top:0; width:211.60000000000002px; height:57.6px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:266.79999999999995px; top:15.84px; width:202.4px; height:47.52px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:55.199999999999996px; top:36px; width:368px; height:31.68px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:2860px; top:36px; width:540px; height:88px; opacity:0.15; filter:blur(37px); animation:mrDrift 126s ease-in-out 8s infinite alternate">
          <div style="position:absolute; left:0; top:24.64px; width:280.8px; height:54.56px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:162px; top:0; width:248.4px; height:70.4px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:313.2px; top:19.36px; width:237.6px; height:58.080000000000005px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:64.8px; top:44px; width:432px; height:38.72px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:3720px; top:92px; width:400px; height:64px; opacity:0.13; filter:blur(27px); animation:mrDrift 110s ease-in-out 4s infinite alternate">
          <div style="position:absolute; left:0; top:17.92px; width:208px; height:39.68px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:120px; top:0; width:184px; height:51.2px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:231.99999999999997px; top:14.08px; width:176px; height:42.24px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:48px; top:32px; width:320px; height:28.16px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:4460px; top:44px; width:580px; height:90px; opacity:0.17; filter:blur(38px); animation:mrDrift 98s ease-in-out 7s infinite alternate">
          <div style="position:absolute; left:0; top:25.200000000000003px; width:301.6px; height:55.8px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:174px; top:0; width:266.8px; height:72px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:336.4px; top:19.8px; width:255.2px; height:59.400000000000006px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:69.6px; top:45px; width:464px; height:39.6px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:5320px; top:88px; width:440px; height:70px; opacity:0.12; filter:blur(29px); animation:mrDrift 122s ease-in-out 1s infinite alternate">
          <div style="position:absolute; left:0; top:19.6px; width:228.8px; height:43.4px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:132px; top:0; width:202.4px; height:56px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:255.2px; top:15.4px; width:193.6px; height:46.2px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:52.8px; top:35px; width:352px; height:30.8px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
        <div style="position:absolute; left:5940px; top:38px; width:500px; height:82px; opacity:0.16; filter:blur(34px); animation:mrDrift 106s ease-in-out 5s infinite alternate">
          <div style="position:absolute; left:0; top:22.96px; width:260px; height:50.839999999999996px; border-radius:50%; background:rgba(196,218,255,.5)"></div>
          <div style="position:absolute; left:150px; top:0; width:230px; height:65.60000000000001px; border-radius:50%; background:rgba(196,218,255,.42)"></div>
          <div style="position:absolute; left:290px; top:18.04px; width:220px; height:54.120000000000005px; border-radius:50%; background:rgba(196,218,255,.36)"></div>
          <div style="position:absolute; left:60px; top:41px; width:400px; height:36.08px; border-radius:50%; background:rgba(196,218,255,.3)"></div>
        </div>
      </div>

      <div data-par="0.05" style="position:absolute; left:0; top:0; width:6400px; height:810px; color:#080f24; pointer-events:none">
        <svg viewBox="0 0 6400 810" preserveAspectRatio="none" style="position:absolute; left:0; top:0; width:6400px; height:810px">
          <path data-ridge="0" d="M0 541.4 L25 540.7 L50 540.0 L75 539.3 L100 538.6 L125 537.8 L150 537.1 L175 536.4 L200 535.7 L225 535.0 L250 534.4 L275 533.8 L300 533.2 L325 532.6 L350 532.1 L375 531.6 L400 531.2 L425 530.7 L450 530.3 L475 529.9 L500 529.5 L525 529.1 L550 528.6 L575 528.1 L600 527.5 L625 526.9 L650 526.1 L675 525.2 L700 524.1 L725 522.8 L750 521.2 L775 519.4 L800 517.3 L825 514.9 L850 512.2 L875 509.2 L900 505.9 L925 502.3 L950 498.4 L975 494.4 L1000 490.3 L1025 486.2 L1050 482.1 L1075 478.2 L1100 474.6 L1125 471.4 L1150 468.5 L1175 466.2 L1200 464.4 L1225 463.1 L1250 462.5 L1275 462.3 L1300 462.7 L1325 463.4 L1350 464.6 L1375 466.0 L1400 467.6 L1425 469.3 L1450 471.1 L1475 472.9 L1500 474.6 L1525 476.2 L1550 477.7 L1575 479.0 L1600 480.2 L1625 481.2 L1650 482.2 L1675 483.0 L1700 483.7 L1725 484.3 L1750 484.9 L1775 485.5 L1800 486.0 L1825 486.5 L1850 487.0 L1875 487.5 L1900 487.9 L1925 488.4 L1950 488.8 L1975 489.2 L2000 489.6 L2025 490.0 L2050 490.3 L2075 490.6 L2100 490.8 L2125 491.0 L2150 491.1 L2175 491.1 L2200 491.1 L2225 491.0 L2250 490.8 L2275 490.6 L2300 490.3 L2325 489.9 L2350 489.5 L2375 489.0 L2400 488.4 L2425 487.9 L2450 487.2 L2475 486.6 L2500 485.9 L2525 485.2 L2550 484.5 L2575 483.8 L2600 483.1 L2625 482.4 L2650 481.7 L2675 481.1 L2700 480.5 L2725 479.9 L2750 479.4 L2775 479.0 L2800 478.6 L2825 478.2 L2850 478.0 L2875 477.7 L2900 477.6 L2925 477.4 L2950 477.4 L2975 477.4 L3000 477.4 L3025 477.4 L3050 477.5 L3075 477.6 L3100 477.7 L3125 477.8 L3150 478.0 L3175 478.1 L3200 478.2 L3225 478.2 L3250 478.2 L3275 478.2 L3300 478.1 L3325 478.0 L3350 477.8 L3375 477.6 L3400 477.2 L3425 476.8 L3450 476.3 L3475 475.8 L3500 475.1 L3525 474.4 L3550 473.6 L3575 472.8 L3600 471.9 L3625 470.9 L3650 469.9 L3675 468.8 L3700 467.8 L3725 466.6 L3750 465.5 L3775 464.4 L3800 463.3 L3825 462.2 L3850 461.2 L3875 460.1 L3900 459.2 L3925 458.3 L3950 457.4 L3975 456.7 L4000 456.0 L4025 455.5 L4050 455.0 L4075 454.6 L4100 454.4 L4125 454.2 L4150 454.2 L4175 454.3 L4200 454.5 L4225 454.8 L4250 455.2 L4275 455.8 L4300 456.4 L4325 457.1 L4350 457.9 L4375 458.8 L4400 459.7 L4425 460.7 L4450 461.8 L4475 462.9 L4500 464.0 L4525 465.2 L4550 466.4 L4575 467.6 L4600 468.8 L4625 469.9 L4650 471.1 L4675 472.2 L4700 473.4 L4725 474.4 L4750 475.5 L4775 476.5 L4800 477.5 L4825 478.5 L4850 479.4 L4875 480.3 L4900 481.1 L4925 482.0 L4950 482.8 L4975 483.6 L5000 484.4 L5025 485.2 L5050 486.0 L5075 486.8 L5100 487.6 L5125 488.5 L5150 489.4 L5175 490.3 L5200 491.3 L5225 492.3 L5250 493.4 L5275 494.5 L5300 495.8 L5325 497.0 L5350 498.4 L5375 499.8 L5400 501.3 L5425 502.9 L5450 504.5 L5475 506.2 L5500 508.0 L5525 509.8 L5550 511.6 L5575 513.5 L5600 515.4 L5625 517.4 L5650 519.3 L5675 521.2 L5700 523.2 L5725 525.0 L5750 526.9 L5775 528.7 L5800 530.5 L5825 532.1 L5850 533.8 L5875 535.3 L5900 536.7 L5925 538.0 L5950 539.2 L5975 540.3 L6000 541.3 L6025 542.1 L6050 542.9 L6075 543.5 L6100 543.9 L6125 544.3 L6150 544.5 L6175 544.6 L6200 544.6 L6225 544.5 L6250 544.3 L6275 544.0 L6300 543.6 L6325 543.1 L6350 542.6 L6375 542.0 L6400 541.4 L6400 810 L0 810 Z" fill="#16224a"></path>
          <path data-crossshadow="1" d="M1155 469 L1161 469 L1165 497 L1151 497 Z M1148 478 L1168 478 L1173 483 L1143 483 Z" fill="#0a122a" opacity="0.4" style="filter:blur(2px)"></path>
          <path data-crossshadow="1" d="M1239 464 L1245 464 L1249 492 L1235 492 Z M1232 473 L1252 473 L1257 478 L1227 478 Z" fill="#0a122a" opacity="0.4" style="filter:blur(2px)"></path>
          <path data-crossshadow="1" d="M1197 465 L1203 465 L1213 519 L1187 519 Z M1179 481 L1221 481 L1226 491 L1174 491 Z" fill="#0a122a" opacity="0.55" style="filter:blur(2.5px)"></path>
          <path data-cross="1" d="M1156 448 h4 v6 h6 v4 h-6 v14 h-4 v-14 h-6 v-4 h6 z" fill="#02040c"></path>
          <path data-cross="1" d="M1240 443 h4 v6 h6 v4 h-6 v14 h-4 v-14 h-6 v-4 h6 z" fill="#02040c"></path>
          <path data-cross="1" d="M1197 423 h6 v11 h11 v6 h-11 v26 h-6 v-26 h-11 v-6 h11 z" fill="#02040c"></path>
        </svg>
        <div style="position:absolute; left:820px; top:483px; width:7px; height:34px; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:2px; bottom:0; width:3px; height:4.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:2.4px; width:7px; height:31.6px; background:currentColor; border-radius:3.5px 3.5px 2px 2px / 19.7px 19.7px 3.4px 3.4px"></div>
    </div>
        <div style="position:absolute; left:842px; top:491px; width:5px; height:24px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 1.6s infinite">
      <div style="position:absolute; left:1px; bottom:0; width:3px; height:3.1px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:1.7px; width:5px; height:22.3px; background:currentColor; border-radius:2.5px 2.5px 1.4px 1.4px / 13.9px 13.9px 2.4px 2.4px"></div>
    </div>
        <div style="position:absolute; left:2460px; top:461px; width:9px; height:28px; background:currentColor; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:3980px; top:433px; width:6px; height:26px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:1.5px; bottom:0; width:3px; height:3.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:1.8px; width:6px; height:24.2px; background:currentColor; border-radius:3px 3px 1.7px 1.7px / 15.1px 15.1px 2.6px 2.6px"></div>
    </div>
        <div style="position:absolute; left:5240px; top:465px; width:10px; height:30px; background:currentColor; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1560px; top:470px; width:26px; height:10px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:4600px; top:463px; width:20px; height:8px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div data-campgroup="1" style="position:absolute; left:596px; top:455px; width:222px; height:111px">
          <div data-fire="1" data-firepool="1" style="position:absolute; left:44px; top:71px; width:141px; height:34px; border-radius:50%; background:radial-gradient(ellipse at center,rgba(255,168,84,.5) 0%,rgba(255,140,60,.2) 42%,rgba(255,130,50,0) 74%); mix-blend-mode:screen; animation:mrShimmer 3.0s ease-in-out 0s infinite"></div>
          <div data-fire="1" style="position:absolute; left:71px; top:28px; width:89px; height:89px; transform:translate(-50%,-50%) translate(44px,44px); border-radius:50%; background:radial-gradient(circle,rgba(255,182,96,.52) 0%,rgba(255,150,64,.18) 38%,rgba(255,140,56,0) 70%); mix-blend-mode:screen; animation:mrShimmer 2.4s ease-in-out 0s infinite"></div>
          <div style="position:absolute; left:0; top:43px; display:flex; align-items:flex-end; gap:7px">
            <div style="width:0; height:0; border-left:21px solid transparent; border-right:21px solid transparent; border-bottom:33px solid currentColor"></div>
            <div style="width:0; height:0; border-left:14px solid transparent; border-right:14px solid transparent; border-bottom:22px solid currentColor"></div>
          </div>
          <div style="position:absolute; left:108px; top:58px; width:10px; height:15px; background:currentColor; border-radius:5px 5px 2px 2px"></div>
          <div style="position:absolute; left:110px; top:50px; width:7px; height:7px; border-radius:50%; background:currentColor"></div>
          <div style="position:absolute; left:145px; top:59px; width:9px; height:13px; background:currentColor; border-radius:4px 4px 2px 2px"></div>
          <div style="position:absolute; left:147px; top:53px; width:6px; height:6px; border-radius:50%; background:currentColor"></div>
          <div style="position:absolute; left:119px; top:75px; width:23px; height:3px; background:currentColor; border-radius:3px; transform:rotate(-13deg)"></div>
          <div style="position:absolute; left:120px; top:76px; width:20px; height:3px; background:currentColor; border-radius:3px; transform:rotate(15deg)"></div>
          <div data-fire="1" style="position:absolute; left:123px; top:60px; width:17px; height:18px; border-radius:50% 50% 44% 44% / 62% 62% 38% 38%; background:radial-gradient(ellipse at 50% 78%,rgba(255,146,54,.92) 0%,rgba(247,120,44,.7) 52%,rgba(230,96,36,0) 82%); animation:mrFlicker 1.9s ease-in-out infinite"></div>
          <div data-fire="1" style="position:absolute; left:126px; top:63px; width:11px; height:14px; border-radius:50% 50% 44% 44% / 64% 64% 36% 36%; background:linear-gradient(180deg,#ffd98a 0%,#ffab52 54%,#f4832f 100%); animation:mrFlicker 1.35s ease-in-out .25s infinite"></div>
          <div data-fire="1" style="position:absolute; left:129px; top:67px; width:6px; height:8px; border-radius:50% 50% 44% 44% / 66% 66% 34% 34%; background:linear-gradient(180deg,#fffdf2,#ffe6a6 62%,#ffc46e); animation:mrFlicker .95s ease-in-out .1s infinite"></div>
          <div data-fire="1" style="position:absolute; left:134px; top:69px; width:7px; height:9px; border-radius:50% 50% 42% 42%; background:linear-gradient(180deg,#ffe3a4,#ff9d4e); animation:mrFlicker 1.1s ease-in-out .4s infinite"></div>
          <div style="position:absolute; left:121px; top:55px; width:24px; height:24px; border-radius:50%; background:rgba(224,232,255,.28); animation:mrSmoke 10s ease-out 0s infinite"></div>
          <div style="position:absolute; left:127px; top:56px; width:31px; height:31px; border-radius:50%; background:rgba(224,232,255,.22); animation:mrSmoke 10s ease-out 2.8s infinite"></div>
          <div style="position:absolute; left:124px; top:53px; width:20px; height:20px; border-radius:50%; background:rgba(224,232,255,.26); animation:mrSmoke 10s ease-out 5.4s infinite"></div>
          <div style="position:absolute; left:130px; top:58px; width:37px; height:37px; border-radius:50%; background:rgba(224,232,255,.16); animation:mrSmoke 10s ease-out 7.8s infinite"></div>
          <div style="position:absolute; left:124px; top:68px; width:3px; height:3px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55); animation:mrEmber 2.8s ease-out 0.0s infinite; --dx:-8px"></div><div style="position:absolute; left:129px; top:68px; width:4px; height:4px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55); animation:mrEmber 3.3s ease-out 0.8s infinite; --dx:-1px"></div><div style="position:absolute; left:134px; top:68px; width:5px; height:5px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55); animation:mrEmber 3.8s ease-out 1.6s infinite; --dx:6px"></div><div style="position:absolute; left:139px; top:68px; width:3px; height:3px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55); animation:mrEmber 4.3s ease-out 2.4s infinite; --dx:13px"></div><div style="position:absolute; left:144px; top:68px; width:4px; height:4px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55); animation:mrEmber 4.8s ease-out 3.2s infinite; --dx:20px"></div>
        </div>
        <div style="position:absolute; left:660px; top:300px; width:13px; height:5px; border-radius:50%; background:currentColor; opacity:0.50; animation:mrWing 1.20s ease-in-out 0.0s infinite"></div><div style="position:absolute; left:698px; top:316px; width:12px; height:4px; border-radius:50%; background:currentColor; opacity:0.45; animation:mrWing 1.35s ease-in-out 0.2s infinite"></div><div style="position:absolute; left:736px; top:332px; width:11px; height:5px; border-radius:50%; background:currentColor; opacity:0.40; animation:mrWing 1.50s ease-in-out 0.4s infinite"></div><div style="position:absolute; left:774px; top:300px; width:10px; height:4px; border-radius:50%; background:currentColor; opacity:0.35; animation:mrWing 1.65s ease-in-out 0.6s infinite"></div><div style="position:absolute; left:2840px; top:286px; width:13px; height:5px; border-radius:50%; background:currentColor; opacity:0.50; animation:mrWing 1.20s ease-in-out 0.0s infinite"></div><div style="position:absolute; left:2878px; top:302px; width:12px; height:4px; border-radius:50%; background:currentColor; opacity:0.45; animation:mrWing 1.35s ease-in-out 0.2s infinite"></div><div style="position:absolute; left:2916px; top:318px; width:11px; height:5px; border-radius:50%; background:currentColor; opacity:0.40; animation:mrWing 1.50s ease-in-out 0.4s infinite"></div><div style="position:absolute; left:5020px; top:306px; width:13px; height:5px; border-radius:50%; background:currentColor; opacity:0.50; animation:mrWing 1.20s ease-in-out 0.0s infinite"></div><div style="position:absolute; left:5058px; top:322px; width:12px; height:4px; border-radius:50%; background:currentColor; opacity:0.45; animation:mrWing 1.35s ease-in-out 0.2s infinite"></div><div style="position:absolute; left:5096px; top:338px; width:11px; height:5px; border-radius:50%; background:currentColor; opacity:0.40; animation:mrWing 1.50s ease-in-out 0.4s infinite"></div>
      </div>

      <div data-par="0.10" style="position:absolute; left:0; top:0; width:6400px; height:810px; color:#04081a; pointer-events:none">
        <svg viewBox="0 0 6400 810" preserveAspectRatio="none" style="position:absolute; left:0; top:0; width:6400px; height:810px">
          <path data-ridge="1" d="M0 601.1 L25 601.1 L50 601.1 L75 601.2 L100 601.3 L125 601.5 L150 601.7 L175 602.0 L200 602.4 L225 602.9 L250 603.4 L275 604.0 L300 604.6 L325 605.3 L350 606.1 L375 607.0 L400 607.9 L425 608.9 L450 609.9 L475 610.9 L500 612.0 L525 613.1 L550 614.2 L575 615.4 L600 616.5 L625 617.6 L650 618.7 L675 619.8 L700 620.8 L725 621.8 L750 622.8 L775 623.7 L800 624.5 L825 625.3 L850 626.0 L875 626.6 L900 627.1 L925 627.5 L950 627.9 L975 628.2 L1000 628.4 L1025 628.5 L1050 628.5 L1075 628.5 L1100 628.4 L1125 628.2 L1150 627.9 L1175 627.6 L1200 627.3 L1225 626.9 L1250 626.5 L1275 626.0 L1300 625.5 L1325 625.0 L1350 624.5 L1375 624.0 L1400 623.5 L1425 623.0 L1450 622.5 L1475 622.0 L1500 621.5 L1525 621.1 L1550 620.7 L1575 620.3 L1600 619.9 L1625 619.5 L1650 619.2 L1675 618.8 L1700 618.5 L1725 618.2 L1750 617.9 L1775 617.6 L1800 617.3 L1825 616.9 L1850 616.6 L1875 616.2 L1900 615.8 L1925 615.4 L1950 614.9 L1975 614.3 L2000 613.8 L2025 613.1 L2050 612.4 L2075 611.6 L2100 610.8 L2125 609.8 L2150 608.8 L2175 607.8 L2200 606.6 L2225 605.4 L2250 604.1 L2275 602.8 L2300 601.4 L2325 599.9 L2350 598.4 L2375 596.9 L2400 595.3 L2425 593.7 L2450 592.1 L2475 590.4 L2500 588.8 L2525 587.2 L2550 585.5 L2575 584.0 L2600 582.4 L2625 580.9 L2650 579.4 L2675 578.0 L2700 576.7 L2725 575.5 L2750 574.3 L2775 573.2 L2800 572.2 L2825 571.2 L2850 570.4 L2875 569.6 L2900 569.0 L2925 568.4 L2950 567.9 L2975 567.6 L3000 567.2 L3025 567.0 L3050 566.8 L3075 566.7 L3100 566.7 L3125 566.7 L3150 566.8 L3175 566.9 L3200 567.0 L3225 567.1 L3250 567.3 L3275 567.5 L3300 567.7 L3325 567.9 L3350 568.0 L3375 568.2 L3400 568.4 L3425 568.5 L3450 568.6 L3475 568.7 L3500 568.8 L3525 568.8 L3550 568.8 L3575 568.8 L3600 568.8 L3625 568.8 L3650 568.7 L3675 568.6 L3700 568.6 L3725 568.5 L3750 568.5 L3775 568.4 L3800 568.4 L3825 568.4 L3850 568.5 L3875 568.6 L3900 568.7 L3925 568.9 L3950 569.1 L3975 569.4 L4000 569.7 L4025 570.1 L4050 570.6 L4075 571.1 L4100 571.8 L4125 572.4 L4150 573.2 L4175 574.0 L4200 574.8 L4225 575.7 L4250 576.7 L4275 577.7 L4300 578.8 L4325 579.8 L4350 580.9 L4375 582.1 L4400 583.2 L4425 584.3 L4450 585.4 L4475 586.5 L4500 587.6 L4525 588.6 L4550 589.6 L4575 590.5 L4600 591.4 L4625 592.3 L4650 593.0 L4675 593.7 L4700 594.3 L4725 594.9 L4750 595.3 L4775 595.7 L4800 596.0 L4825 596.2 L4850 596.4 L4875 596.5 L4900 596.5 L4925 596.4 L4950 596.3 L4975 596.2 L5000 596.0 L5025 595.7 L5050 595.4 L5075 595.1 L5100 594.8 L5125 594.5 L5150 594.2 L5175 593.9 L5200 593.6 L5225 593.3 L5250 593.0 L5275 592.8 L5300 592.7 L5325 592.5 L5350 592.5 L5375 592.4 L5400 592.5 L5425 592.5 L5450 592.7 L5475 592.8 L5500 593.1 L5525 593.4 L5550 593.7 L5575 594.1 L5600 594.5 L5625 594.9 L5650 595.4 L5675 595.9 L5700 596.4 L5725 596.9 L5750 597.4 L5775 597.9 L5800 598.4 L5825 598.9 L5850 599.3 L5875 599.8 L5900 600.2 L5925 600.5 L5950 600.8 L5975 601.1 L6000 601.4 L6025 601.6 L6050 601.7 L6075 601.8 L6100 601.9 L6125 601.9 L6150 601.9 L6175 601.9 L6200 601.8 L6225 601.7 L6250 601.6 L6275 601.5 L6300 601.4 L6325 601.3 L6350 601.2 L6375 601.2 L6400 601.1 L6400 810 L0 810 Z" fill="#101a3a"></path>
        </svg>
        <div style="position:absolute; left:300px; top:549px; width:18px; height:58px; background:currentColor; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:326px; top:565px; width:9px; height:42px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 1.6s infinite">
      <div style="position:absolute; left:3px; bottom:0; width:3px; height:5.5px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:2.9px; width:9px; height:39.1px; background:currentColor; border-radius:4.5px 4.5px 2.5px 2.5px / 24.4px 24.4px 4.2px 4.2px"></div>
    </div>
        <div style="position:absolute; left:348px; top:580px; width:10px; height:28px; background:currentColor; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1080px; top:582px; width:15px; height:48px; background:currentColor; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1660px; top:585px; width:26px; height:36px">
      <div style="position:absolute; left:10.5px; bottom:0; width:5px; height:15.8px; background:currentColor"></div>
      <div style="position:absolute; left:7.8px; bottom:11.5px; width:3px; height:7.9px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:17.2px; bottom:11.5px; width:3px; height:7.9px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:26px; height:23px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 0.9s infinite">
        <div style="position:absolute; left:3.4px; top:2.1px; width:16.1px; height:15.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:6.7px; width:12.5px; height:13.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:11.2px; top:5.3px; width:14.8px; height:14.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:7px; top:0px; width:12px; height:11px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:14.8px; top:9.9px; width:11.2px; height:10.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:1.3px; top:10.3px; width:10.9px; height:10.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:7.8px; top:11.5px; width:10.4px; height:9.2px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:2330px; top:536px; width:20px; height:66px; background:currentColor; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:2362px; top:554px; width:10px; height:46px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 0.0s infinite">
      <div style="position:absolute; left:3.5px; bottom:0; width:3px; height:6px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:3.2px; width:10px; height:42.8px; background:currentColor; border-radius:5px 5px 2.8px 2.8px / 26.7px 26.7px 4.6px 4.6px"></div>
    </div>
        <div style="position:absolute; left:3020px; top:539px; width:22px; height:30px">
      <div style="position:absolute; left:8.5px; bottom:0; width:5px; height:13.2px; background:currentColor"></div>
      <div style="position:absolute; left:6.6px; bottom:9.6px; width:3px; height:6.6px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:14.5px; bottom:9.6px; width:3px; height:6.6px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:22px; height:19.2px; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 1.8s infinite">
        <div style="position:absolute; left:2.9px; top:1.7px; width:13.6px; height:13.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:5.6px; width:10.6px; height:11.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:9.5px; top:4.4px; width:12.5px; height:11.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:5.9px; top:0px; width:10.1px; height:9.2px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:12.5px; top:8.3px; width:9.5px; height:8.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:1.1px; top:8.6px; width:9.2px; height:8.4px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:6.6px; top:9.6px; width:8.8px; height:7.7px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:3640px; top:511px; width:18px; height:60px; background:currentColor; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 1.4s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:4280px; top:534px; width:14px; height:46px; background:currentColor; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:4304px; top:547px; width:8px; height:34px; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 0.0s infinite">
      <div style="position:absolute; left:2.5px; bottom:0; width:3px; height:4.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:2.4px; width:8px; height:31.6px; background:currentColor; border-radius:4px 4px 2.2px 2.2px / 19.7px 19.7px 3.4px 3.4px"></div>
    </div>
        <div style="position:absolute; left:5060px; top:563px; width:24px; height:34px">
      <div style="position:absolute; left:9.5px; bottom:0; width:5px; height:15px; background:currentColor"></div>
      <div style="position:absolute; left:7.2px; bottom:10.9px; width:3px; height:7.5px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:15.8px; bottom:10.9px; width:3px; height:7.5px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:24px; height:21.8px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 2.7s infinite">
        <div style="position:absolute; left:3.1px; top:2px; width:14.9px; height:14.8px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:6.3px; width:11.5px; height:12.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:10.3px; top:5px; width:13.7px; height:13.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:6.5px; top:0px; width:11px; height:10.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:13.7px; top:9.4px; width:10.3px; height:9.8px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:1.2px; top:9.8px; width:10.1px; height:9.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:7.2px; top:10.9px; width:9.6px; height:8.7px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:5700px; top:546px; width:16px; height:52px; background:currentColor; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 0.0s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:6100px; top:564px; width:9px; height:40px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 1.6s infinite">
      <div style="position:absolute; left:3px; bottom:0; width:3px; height:5.2px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:2.8px; width:9px; height:37.2px; background:currentColor; border-radius:4.5px 4.5px 2.5px 2.5px / 23.2px 23.2px 4px 4px"></div>
    </div>
        <div style="position:absolute; left:900px; top:615px; width:34px; height:14px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:2900px; top:559px; width:30px; height:12px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div style="position:absolute; left:4900px; top:585px; width:32px; height:13px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:5400px; top:578px; width:26px; height:16px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 1s infinite">
      <div style="position:absolute; left:0; bottom:0; width:14.6px; height:13.1px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:8.8px; bottom:0; width:13px; height:16px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:16.1px; bottom:0; width:9.9px; height:11.2px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:1930px; top:585px; display:flex; align-items:flex-end; gap:22px"><div style="position:relative; width:48px; height:32px"><div style="position:absolute; left:0; bottom:8px; width:34px; height:12px; background:currentColor; border-radius:8px 10px 4px 4px"></div><div style="position:absolute; left:6px; bottom:17px; width:11px; height:9px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:18px; bottom:17px; width:11px; height:8px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:30px; bottom:14px; width:4px; height:15px; background:currentColor; transform:rotate(-13deg)"></div><div style="position:absolute; left:31px; bottom:26px; width:10px; height:6px; background:currentColor; border-radius:3px"></div><div style="position:absolute; left:3px; bottom:0; width:3px; height:10px; background:currentColor"></div><div style="position:absolute; left:26px; bottom:0; width:3px; height:10px; background:currentColor"></div></div><div style="position:relative; width:41px; height:27px"><div style="position:absolute; left:0; bottom:8px; width:29px; height:10px; background:currentColor; border-radius:7px 9px 4px 4px"></div><div style="position:absolute; left:5px; bottom:14px; width:9px; height:8px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:15px; bottom:14px; width:9px; height:7px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:26px; bottom:12px; width:3px; height:13px; background:currentColor; transform:rotate(-13deg)"></div><div style="position:absolute; left:26px; bottom:22px; width:9px; height:5px; background:currentColor; border-radius:3px"></div><div style="position:absolute; left:3px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:22px; bottom:0; width:3px; height:9px; background:currentColor"></div></div></div>
      </div>

      <div data-par="0.17" style="position:absolute; left:0; top:0; width:6400px; height:810px; color:#01030c; pointer-events:none">
        <svg viewBox="0 0 6400 810" preserveAspectRatio="none" style="position:absolute; left:0; top:0; width:6400px; height:810px">
          <path data-ridge="2" d="M0 663.3 L25 662.4 L50 661.7 L75 661.1 L100 660.7 L125 660.5 L150 660.4 L175 660.5 L200 660.6 L225 660.8 L250 661.1 L275 661.4 L300 661.7 L325 662.0 L350 662.3 L375 662.6 L400 662.8 L425 663.1 L450 663.3 L475 663.6 L500 663.9 L525 664.3 L550 664.8 L575 665.3 L600 666.0 L625 666.8 L650 667.8 L675 668.9 L700 670.2 L725 671.6 L750 673.2 L775 674.9 L800 676.7 L825 678.6 L850 680.6 L875 682.5 L900 684.4 L925 686.3 L950 688.1 L975 689.8 L1000 691.3 L1025 692.6 L1050 693.7 L1075 694.7 L1100 695.4 L1125 695.9 L1150 696.2 L1175 696.4 L1200 696.4 L1225 696.3 L1250 696.0 L1275 695.7 L1300 695.3 L1325 695.0 L1350 694.6 L1375 694.3 L1400 694.0 L1425 693.8 L1450 693.6 L1475 693.5 L1500 693.5 L1525 693.5 L1550 693.6 L1575 693.7 L1600 693.8 L1625 693.9 L1650 693.9 L1675 693.9 L1700 693.8 L1725 693.7 L1750 693.4 L1775 693.0 L1800 692.5 L1825 692.0 L1850 691.3 L1875 690.6 L1900 689.9 L1925 689.1 L1950 688.4 L1975 687.7 L2000 687.1 L2025 686.5 L2050 686.1 L2075 685.8 L2100 685.6 L2125 685.7 L2150 685.8 L2175 686.1 L2200 686.6 L2225 687.1 L2250 687.8 L2275 688.5 L2300 689.2 L2325 689.9 L2350 690.6 L2375 691.3 L2400 691.8 L2425 692.2 L2450 692.4 L2475 692.5 L2500 692.4 L2525 692.1 L2550 691.7 L2575 691.1 L2600 690.3 L2625 689.4 L2650 688.4 L2675 687.3 L2700 686.1 L2725 684.9 L2750 683.7 L2775 682.6 L2800 681.5 L2825 680.4 L2850 679.4 L2875 678.5 L2900 677.6 L2925 676.9 L2950 676.2 L2975 675.5 L3000 674.8 L3025 674.2 L3050 673.6 L3075 672.9 L3100 672.1 L3125 671.4 L3150 670.5 L3175 669.6 L3200 668.5 L3225 667.4 L3250 666.3 L3275 665.1 L3300 663.9 L3325 662.7 L3350 661.5 L3375 660.4 L3400 659.4 L3425 658.5 L3450 657.8 L3475 657.3 L3500 657.0 L3525 656.9 L3550 657.1 L3575 657.5 L3600 658.1 L3625 659.0 L3650 660.0 L3675 661.2 L3700 662.6 L3725 664.1 L3750 665.7 L3775 667.4 L3800 669.1 L3825 670.7 L3850 672.3 L3875 673.9 L3900 675.4 L3925 676.8 L3950 678.0 L3975 679.2 L4000 680.3 L4025 681.2 L4050 682.1 L4075 683.0 L4100 683.7 L4125 684.5 L4150 685.3 L4175 686.0 L4200 686.8 L4225 687.7 L4250 688.6 L4275 689.5 L4300 690.5 L4325 691.5 L4350 692.5 L4375 693.6 L4400 694.6 L4425 695.6 L4450 696.5 L4475 697.3 L4500 698.0 L4525 698.5 L4550 698.9 L4575 699.1 L4600 699.1 L4625 698.9 L4650 698.6 L4675 698.1 L4700 697.4 L4725 696.6 L4750 695.6 L4775 694.6 L4800 693.6 L4825 692.6 L4850 691.5 L4875 690.6 L4900 689.7 L4925 688.9 L4950 688.3 L4975 687.8 L5000 687.5 L5025 687.3 L5050 687.3 L5075 687.4 L5100 687.6 L5125 687.9 L5150 688.3 L5175 688.8 L5200 689.2 L5225 689.7 L5250 690.1 L5275 690.4 L5300 690.7 L5325 690.9 L5350 690.9 L5375 690.9 L5400 690.8 L5425 690.6 L5450 690.3 L5475 689.9 L5500 689.5 L5525 689.1 L5550 688.7 L5575 688.3 L5600 688.0 L5625 687.7 L5650 687.5 L5675 687.3 L5700 687.3 L5725 687.3 L5750 687.3 L5775 687.4 L5800 687.6 L5825 687.7 L5850 687.8 L5875 687.8 L5900 687.8 L5925 687.7 L5950 687.4 L5975 686.9 L6000 686.3 L6025 685.6 L6050 684.6 L6075 683.4 L6100 682.1 L6125 680.7 L6150 679.1 L6175 677.4 L6200 675.7 L6225 673.9 L6250 672.1 L6275 670.4 L6300 668.7 L6325 667.1 L6350 665.7 L6375 664.4 L6400 663.3 L6400 810 L0 810 Z" fill="#0a122a"></path>
        </svg>
        <div style="position:absolute; left:300px; top:556px; width:32px; height:108px; background:currentColor; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:338px; top:584px; width:16px; height:80px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 1.6s infinite">
      <div style="position:absolute; left:6.5px; bottom:0; width:3px; height:10.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:5.6px; width:16px; height:74.4px; background:currentColor; border-radius:8px 8px 4.5px 4.5px / 46.4px 46.4px 8px 8px"></div>
    </div>
        <div style="position:absolute; left:366px; top:612px; width:17px; height:52px; background:currentColor; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:388px; top:631px; width:12px; height:34px; background:currentColor; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:740px; top:617px; width:42px; height:58px">
      <div style="position:absolute; left:18.5px; bottom:0; width:5px; height:25.5px; background:currentColor"></div>
      <div style="position:absolute; left:12.6px; bottom:18.6px; width:3px; height:12.8px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:27.7px; bottom:18.6px; width:3px; height:12.8px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:42px; height:37.1px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 0.9s infinite">
        <div style="position:absolute; left:5.5px; top:3.3px; width:26px; height:25.2px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:10.8px; width:20.2px; height:21.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:18.1px; top:8.5px; width:23.9px; height:23px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:11.3px; top:0px; width:19.3px; height:17.8px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:23.9px; top:16px; width:18.1px; height:16.7px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:2.1px; top:16.7px; width:17.6px; height:16.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:12.6px; top:18.6px; width:16.8px; height:14.8px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:802px; top:639px; width:28px; height:40px">
      <div style="position:absolute; left:11.5px; bottom:0; width:5px; height:17.6px; background:currentColor"></div>
      <div style="position:absolute; left:8.4px; bottom:12.8px; width:3px; height:8.8px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:18.5px; bottom:12.8px; width:3px; height:8.8px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:28px; height:25.6px; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 1.8s infinite">
        <div style="position:absolute; left:3.6px; top:2.3px; width:17.4px; height:17.4px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:7.4px; width:13.4px; height:14.8px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:12px; top:5.9px; width:16px; height:15.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:7.6px; top:0px; width:12.9px; height:12.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:16px; top:11px; width:12px; height:11.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:1.4px; top:11.5px; width:11.8px; height:11.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:8.4px; top:12.8px; width:11.2px; height:10.2px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:1160px; top:606px; width:28px; height:92px; background:currentColor; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1500px; top:623px; width:44px; height:72px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out infinite">
      <div style="position:absolute; left:20px; bottom:0; width:4px; height:72px; background:currentColor"></div>
      <div style="position:absolute; left:20px; bottom:36px; width:19.4px; height:3px; background:currentColor; transform:rotate(-36deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:8.8px; bottom:30.2px; width:17.2px; height:3px; background:currentColor; transform:rotate(32deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:20px; bottom:51.8px; width:15px; height:3px; background:currentColor; transform:rotate(-24deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:8.8px; bottom:47.5px; width:12.8px; height:2px; background:currentColor; transform:rotate(26deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:20px; bottom:61.9px; width:10.6px; height:2px; background:currentColor; transform:rotate(-30deg); transform-origin:left bottom"></div>
    </div>
        <div style="position:absolute; left:1900px; top:570px; width:36px; height:122px; background:currentColor; transform-origin:bottom center; animation:mrSway 9.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1946px; top:603px; width:18px; height:88px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:7.5px; bottom:0; width:3px; height:11.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:6.2px; width:18px; height:81.8px; background:currentColor; border-radius:9px 9px 5px 5px / 51px 51px 8.8px 8.8px"></div>
    </div>
        <div style="position:absolute; left:2320px; top:630px; width:42px; height:62px; transform-origin:bottom center; animation:mrSway 9.0s ease-in-out 0.6s infinite">
      <div style="position:absolute; left:18.5px; bottom:0; width:3.8px; height:45.9px; background:currentColor; border-radius:2px; transform:rotate(4deg); transform-origin:bottom center"></div>
      <div style="position:absolute; left:20.6px; top:11.8px; width:22.7px; height:5.6px; background:currentColor; border-radius:11.3px 11.3px 6.4px 6.4px; transform-origin:left center; transform:rotate(-76deg)"></div>
      <div style="position:absolute; left:20.6px; top:11.8px; width:22.7px; height:5.6px; background:currentColor; border-radius:11.3px 11.3px 6.4px 6.4px; transform-origin:left center; transform:rotate(-42deg)"></div>
      <div style="position:absolute; left:20.6px; top:11.8px; width:22.7px; height:5.6px; background:currentColor; border-radius:11.3px 11.3px 6.4px 6.4px; transform-origin:left center; transform:rotate(-14deg)"></div>
      <div style="position:absolute; left:20.6px; top:11.8px; width:22.7px; height:5.6px; background:currentColor; border-radius:11.3px 11.3px 6.4px 6.4px; transform-origin:left center; transform:rotate(14deg)"></div>
      <div style="position:absolute; left:20.6px; top:11.8px; width:22.7px; height:5.6px; background:currentColor; border-radius:11.3px 11.3px 6.4px 6.4px; transform-origin:left center; transform:rotate(42deg)"></div>
      <div style="position:absolute; left:20.6px; top:11.8px; width:22.7px; height:5.6px; background:currentColor; border-radius:11.3px 11.3px 6.4px 6.4px; transform-origin:left center; transform:rotate(76deg)"></div>
      <div style="position:absolute; left:17.2px; top:9.9px; width:7.6px; height:5px; border-radius:50%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:2700px; top:588px; width:30px; height:100px; background:currentColor; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:3080px; top:609px; width:21px; height:66px; background:currentColor; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:3104px; top:630px; width:10px; height:44px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:3.5px; bottom:0; width:3px; height:5.7px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:3.1px; width:10px; height:40.9px; background:currentColor; border-radius:5px 5px 2.8px 2.8px / 25.5px 25.5px 4.4px 4.4px"></div>
    </div>
        <div style="position:absolute; left:3480px; top:597px; width:44px; height:62px">
      <div style="position:absolute; left:19.5px; bottom:0; width:5px; height:27.3px; background:currentColor"></div>
      <div style="position:absolute; left:13.2px; bottom:19.8px; width:3px; height:13.6px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:29px; bottom:19.8px; width:3px; height:13.6px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:44px; height:39.7px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite">
        <div style="position:absolute; left:5.7px; top:3.6px; width:27.3px; height:27px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:11.5px; width:21.1px; height:23px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:18.9px; top:9.1px; width:25.1px; height:24.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:11.9px; top:0px; width:20.2px; height:19.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:25.1px; top:17.1px; width:18.9px; height:17.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:2.2px; top:17.9px; width:18.5px; height:17.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:13.2px; top:19.9px; width:17.6px; height:15.9px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:3860px; top:595px; width:48px; height:80px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out infinite">
      <div style="position:absolute; left:22px; bottom:0; width:4px; height:80px; background:currentColor"></div>
      <div style="position:absolute; left:22px; bottom:40px; width:21.1px; height:3px; background:currentColor; transform:rotate(-36deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:9.6px; bottom:33.6px; width:18.7px; height:3px; background:currentColor; transform:rotate(32deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:22px; bottom:57.6px; width:16.3px; height:3px; background:currentColor; transform:rotate(-24deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:9.6px; bottom:52.8px; width:13.9px; height:2px; background:currentColor; transform:rotate(26deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:22px; bottom:68.8px; width:11.5px; height:2px; background:currentColor; transform:rotate(-30deg); transform-origin:left bottom"></div>
    </div>
        <div style="position:absolute; left:4240px; top:578px; width:33px; height:112px; background:currentColor; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:4286px; top:610px; width:17px; height:82px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 0.0s infinite">
      <div style="position:absolute; left:7px; bottom:0; width:3px; height:10.7px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:5.7px; width:17px; height:76.3px; background:currentColor; border-radius:8.5px 8.5px 4.8px 4.8px / 47.6px 47.6px 8.2px 8.2px"></div>
    </div>
        <div style="position:absolute; left:4640px; top:645px; width:38px; height:56px; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 1.2s infinite">
      <div style="position:absolute; left:16.7px; bottom:0; width:3.4px; height:41.4px; background:currentColor; border-radius:2px; transform:rotate(4deg); transform-origin:bottom center"></div>
      <div style="position:absolute; left:18.6px; top:10.6px; width:20.5px; height:5px; background:currentColor; border-radius:10.3px 10.3px 5.7px 5.7px; transform-origin:left center; transform:rotate(-76deg)"></div>
      <div style="position:absolute; left:18.6px; top:10.6px; width:20.5px; height:5px; background:currentColor; border-radius:10.3px 10.3px 5.7px 5.7px; transform-origin:left center; transform:rotate(-42deg)"></div>
      <div style="position:absolute; left:18.6px; top:10.6px; width:20.5px; height:5px; background:currentColor; border-radius:10.3px 10.3px 5.7px 5.7px; transform-origin:left center; transform:rotate(-14deg)"></div>
      <div style="position:absolute; left:18.6px; top:10.6px; width:20.5px; height:5px; background:currentColor; border-radius:10.3px 10.3px 5.7px 5.7px; transform-origin:left center; transform:rotate(14deg)"></div>
      <div style="position:absolute; left:18.6px; top:10.6px; width:20.5px; height:5px; background:currentColor; border-radius:10.3px 10.3px 5.7px 5.7px; transform-origin:left center; transform:rotate(42deg)"></div>
      <div style="position:absolute; left:18.6px; top:10.6px; width:20.5px; height:5px; background:currentColor; border-radius:10.3px 10.3px 5.7px 5.7px; transform-origin:left center; transform:rotate(76deg)"></div>
      <div style="position:absolute; left:15.6px; top:9px; width:6.8px; height:4.5px; border-radius:50%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:5020px; top:593px; width:29px; height:96px; background:currentColor; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:5440px; top:624px; width:42px; height:68px; transform-origin:bottom center; animation:mrSway 15.0s ease-in-out infinite">
      <div style="position:absolute; left:19px; bottom:0; width:4px; height:68px; background:currentColor"></div>
      <div style="position:absolute; left:19px; bottom:34px; width:18.5px; height:3px; background:currentColor; transform:rotate(-36deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:8.4px; bottom:28.6px; width:16.4px; height:3px; background:currentColor; transform:rotate(32deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:19px; bottom:49px; width:14.3px; height:3px; background:currentColor; transform:rotate(-24deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:8.4px; bottom:44.9px; width:12.2px; height:2px; background:currentColor; transform:rotate(26deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:19px; bottom:58.5px; width:10.1px; height:2px; background:currentColor; transform:rotate(-30deg); transform-origin:left bottom"></div>
    </div>
        <div style="position:absolute; left:5820px; top:572px; width:35px; height:118px; background:currentColor; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:5864px; top:606px; width:17px; height:84px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite">
      <div style="position:absolute; left:7px; bottom:0; width:3px; height:10.9px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:5.9px; width:17px; height:78.1px; background:currentColor; border-radius:8.5px 8.5px 4.8px 4.8px / 48.7px 48.7px 8.4px 8.4px"></div>
    </div>
        <div style="position:absolute; left:6220px; top:622px; width:38px; height:54px">
      <div style="position:absolute; left:16.5px; bottom:0; width:5px; height:23.8px; background:currentColor"></div>
      <div style="position:absolute; left:11.4px; bottom:17.3px; width:3px; height:11.9px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:25.1px; bottom:17.3px; width:3px; height:11.9px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:38px; height:34.6px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 1.8s infinite">
        <div style="position:absolute; left:4.9px; top:3.1px; width:23.6px; height:23.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:10px; width:18.2px; height:20.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:16.3px; top:8px; width:21.7px; height:21.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:10.3px; top:0px; width:17.5px; height:16.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:21.7px; top:14.9px; width:16.3px; height:15.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:1.9px; top:15.6px; width:16px; height:15.2px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:11.4px; top:17.3px; width:15.2px; height:13.8px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:620px; top:649px; width:48px; height:20px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:1300px; top:673px; width:38px; height:24px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 1s infinite">
      <div style="position:absolute; left:0; bottom:0; width:21.3px; height:19.7px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:12.9px; bottom:0; width:19px; height:24px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:23.6px; bottom:0; width:14.4px; height:16.8px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:2100px; top:670px; width:42px; height:18px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div style="position:absolute; left:2900px; top:658px; width:34px; height:22px; transform-origin:bottom center; animation:mrSway 15.0s ease-in-out 2s infinite">
      <div style="position:absolute; left:0; bottom:0; width:19px; height:18px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:11.6px; bottom:0; width:17px; height:22px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:21.1px; bottom:0; width:12.9px; height:15.4px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:3660px; top:638px; width:56px; height:24px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:4460px; top:679px; width:32px; height:20px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 0s infinite">
      <div style="position:absolute; left:0; bottom:0; width:17.9px; height:16.4px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:10.9px; bottom:0; width:16px; height:20px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:19.8px; bottom:0; width:12.2px; height:14px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:5240px; top:673px; width:44px; height:19px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div style="position:absolute; left:6000px; top:665px; width:36px; height:23px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 1s infinite">
      <div style="position:absolute; left:0; bottom:0; width:20.2px; height:18.9px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:12.2px; bottom:0; width:18px; height:23px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:22.3px; bottom:0; width:13.7px; height:16.1px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:980px; top:676px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:11.2px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:16px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:8.8px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:13.6px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:2500px; top:680px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:9.8px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:14px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:7.7px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:11.9px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 11.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:4000px; top:665px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:11.9px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 6.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:17px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:9.4px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:14.4px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:5600px; top:675px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:10.5px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:15px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:8.3px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:12.8px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div data-campgroup="1" style="position:absolute; left:2140px; top:591px; width:285px; height:143px">
          <div data-fire="1" data-firepool="1" style="position:absolute; left:57px; top:91px; width:181px; height:44px; border-radius:50%; background:radial-gradient(ellipse at center,rgba(255,168,84,.5) 0%,rgba(255,140,60,.2) 42%,rgba(255,130,50,0) 74%); mix-blend-mode:screen; animation:mrShimmer 3.4s ease-in-out 0.5s infinite"></div>
          <div data-fire="1" style="position:absolute; left:91px; top:36px; width:114px; height:114px; transform:translate(-50%,-50%) translate(57px,57px); border-radius:50%; background:radial-gradient(circle,rgba(255,182,96,.52) 0%,rgba(255,150,64,.18) 38%,rgba(255,140,56,0) 70%); mix-blend-mode:screen; animation:mrShimmer 2.7s ease-in-out 0.3s infinite"></div>
          <div style="position:absolute; left:0; top:55px; display:flex; align-items:flex-end; gap:9px">
            <div style="width:0; height:0; border-left:27px solid transparent; border-right:27px solid transparent; border-bottom:42px solid currentColor"></div>
            <div style="width:0; height:0; border-left:18px solid transparent; border-right:18px solid transparent; border-bottom:29px solid currentColor"></div>
          </div>
          <div style="position:absolute; left:139px; top:74px; width:12px; height:19px; background:currentColor; border-radius:7px 7px 2px 2px"></div>
          <div style="position:absolute; left:141px; top:65px; width:9px; height:9px; border-radius:50%; background:currentColor"></div>
          <div style="position:absolute; left:186px; top:76px; width:11px; height:17px; background:currentColor; border-radius:6px 6px 2px 2px"></div>
          <div style="position:absolute; left:188px; top:67px; width:8px; height:8px; border-radius:50%; background:currentColor"></div>
          <div style="position:absolute; left:153px; top:96px; width:28px; height:4px; background:currentColor; border-radius:4px; transform:rotate(-13deg)"></div>
          <div style="position:absolute; left:155px; top:98px; width:24px; height:4px; background:currentColor; border-radius:4px; transform:rotate(15deg)"></div>
          <div data-fire="1" style="position:absolute; left:158px; top:78px; width:21px; height:23px; border-radius:50% 50% 44% 44% / 62% 62% 38% 38%; background:radial-gradient(ellipse at 50% 78%,rgba(255,146,54,.92) 0%,rgba(247,120,44,.7) 52%,rgba(230,96,36,0) 82%); animation:mrFlicker 1.9s ease-in-out infinite"></div>
          <div data-fire="1" style="position:absolute; left:162px; top:82px; width:14px; height:18px; border-radius:50% 50% 44% 44% / 64% 64% 36% 36%; background:linear-gradient(180deg,#ffd98a 0%,#ffab52 54%,#f4832f 100%); animation:mrFlicker 1.35s ease-in-out .25s infinite"></div>
          <div data-fire="1" style="position:absolute; left:165px; top:87px; width:7px; height:10px; border-radius:50% 50% 44% 44% / 66% 66% 34% 34%; background:linear-gradient(180deg,#fffdf2,#ffe6a6 62%,#ffc46e); animation:mrFlicker .95s ease-in-out .1s infinite"></div>
          <div data-fire="1" style="position:absolute; left:172px; top:88px; width:9px; height:11px; border-radius:50% 50% 42% 42%; background:linear-gradient(180deg,#ffe3a4,#ff9d4e); animation:mrFlicker 1.1s ease-in-out .4s infinite"></div>
          <div style="position:absolute; left:156px; top:70px; width:29px; height:29px; border-radius:50%; background:rgba(224,232,255,.28); animation:mrSmoke 10s ease-out 0.6s infinite"></div>
          <div style="position:absolute; left:163px; top:72px; width:37px; height:37px; border-radius:50%; background:rgba(224,232,255,.22); animation:mrSmoke 10s ease-out 3.4s infinite"></div>
          <div style="position:absolute; left:159px; top:68px; width:24px; height:24px; border-radius:50%; background:rgba(224,232,255,.26); animation:mrSmoke 10s ease-out 6.0s infinite"></div>
          <div style="position:absolute; left:167px; top:74px; width:44px; height:44px; border-radius:50%; background:rgba(224,232,255,.16); animation:mrSmoke 10s ease-out 8.4s infinite"></div>
          
        </div>
        <div data-campgroup="1" style="position:absolute; left:4460px; top:612px; width:255px; height:128px">
          <div data-fire="1" data-firepool="1" style="position:absolute; left:51px; top:82px; width:162px; height:39px; border-radius:50%; background:radial-gradient(ellipse at center,rgba(255,168,84,.5) 0%,rgba(255,140,60,.2) 42%,rgba(255,130,50,0) 74%); mix-blend-mode:screen; animation:mrShimmer 3.8s ease-in-out 1.0s infinite"></div>
          <div data-fire="1" style="position:absolute; left:82px; top:32px; width:102px; height:102px; transform:translate(-50%,-50%) translate(51px,51px); border-radius:50%; background:radial-gradient(circle,rgba(255,182,96,.52) 0%,rgba(255,150,64,.18) 38%,rgba(255,140,56,0) 70%); mix-blend-mode:screen; animation:mrShimmer 3.0s ease-in-out 0.6s infinite"></div>
          <div style="position:absolute; left:0; top:49px; display:flex; align-items:flex-end; gap:8px">
            <div style="width:0; height:0; border-left:24px solid transparent; border-right:24px solid transparent; border-bottom:37px solid currentColor"></div>
            <div style="width:0; height:0; border-left:16px solid transparent; border-right:16px solid transparent; border-bottom:26px solid currentColor"></div>
          </div>
          <div style="position:absolute; left:124px; top:66px; width:11px; height:17px; background:currentColor; border-radius:6px 6px 2px 2px"></div>
          <div style="position:absolute; left:126px; top:58px; width:8px; height:8px; border-radius:50%; background:currentColor"></div>
          <div style="position:absolute; left:167px; top:68px; width:10px; height:15px; background:currentColor; border-radius:5px 5px 2px 2px"></div>
          <div style="position:absolute; left:168px; top:60px; width:7px; height:7px; border-radius:50%; background:currentColor"></div>
          <div style="position:absolute; left:137px; top:86px; width:25px; height:4px; background:currentColor; border-radius:4px; transform:rotate(-13deg)"></div>
          <div style="position:absolute; left:138px; top:88px; width:22px; height:4px; background:currentColor; border-radius:4px; transform:rotate(15deg)"></div>
          <div data-fire="1" style="position:absolute; left:142px; top:69px; width:19px; height:21px; border-radius:50% 50% 44% 44% / 62% 62% 38% 38%; background:radial-gradient(ellipse at 50% 78%,rgba(255,146,54,.92) 0%,rgba(247,120,44,.7) 52%,rgba(230,96,36,0) 82%); animation:mrFlicker 1.9s ease-in-out infinite"></div>
          <div data-fire="1" style="position:absolute; left:145px; top:73px; width:13px; height:17px; border-radius:50% 50% 44% 44% / 64% 64% 36% 36%; background:linear-gradient(180deg,#ffd98a 0%,#ffab52 54%,#f4832f 100%); animation:mrFlicker 1.35s ease-in-out .25s infinite"></div>
          <div data-fire="1" style="position:absolute; left:148px; top:78px; width:6px; height:10px; border-radius:50% 50% 44% 44% / 66% 66% 34% 34%; background:linear-gradient(180deg,#fffdf2,#ffe6a6 62%,#ffc46e); animation:mrFlicker .95s ease-in-out .1s infinite"></div>
          <div data-fire="1" style="position:absolute; left:154px; top:79px; width:8px; height:10px; border-radius:50% 50% 42% 42%; background:linear-gradient(180deg,#ffe3a4,#ff9d4e); animation:mrFlicker 1.1s ease-in-out .4s infinite"></div>
          <div style="position:absolute; left:139px; top:63px; width:27px; height:27px; border-radius:50%; background:rgba(224,232,255,.28); animation:mrSmoke 10s ease-out 1.2s infinite"></div>
          <div style="position:absolute; left:146px; top:65px; width:34px; height:34px; border-radius:50%; background:rgba(224,232,255,.22); animation:mrSmoke 10s ease-out 4.0s infinite"></div>
          <div style="position:absolute; left:142px; top:61px; width:22px; height:22px; border-radius:50%; background:rgba(224,232,255,.26); animation:mrSmoke 10s ease-out 6.6s infinite"></div>
          <div style="position:absolute; left:150px; top:66px; width:41px; height:41px; border-radius:50%; background:rgba(224,232,255,.16); animation:mrSmoke 10s ease-out 9.0s infinite"></div>
          
        </div>
        <div style="position:absolute; left:1300px; top:677px; display:flex; align-items:flex-end; gap:18px"><div style="position:relative; width:29px; height:17px; background:currentColor; border-radius:14.5px 14.5px 4px 4px"><div style="position:absolute; left:24px; top:-7px; width:9px; height:9px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div><div style="position:relative; width:25px; height:14px; background:currentColor; border-radius:12.5px 12.5px 4px 4px"><div style="position:absolute; left:20px; top:-6px; width:8px; height:8px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div><div style="position:relative; width:21px; height:12px; background:currentColor; border-radius:10.5px 10.5px 4px 4px"><div style="position:absolute; left:16px; top:-5px; width:6px; height:6px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div></div>
        <div style="position:absolute; left:3300px; top:630px; width:46px; height:36px"><div style="position:absolute; left:0; bottom:7px; width:32px; height:16px; background:currentColor; border-radius:10px 13px 5px 5px"></div><div style="position:absolute; left:3px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:11px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:26px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:22px; bottom:14px; width:4px; height:12px; background:currentColor; transform:rotate(-16deg)"></div><div style="position:absolute; left:26px; bottom:22px; width:11px; height:11px; background:currentColor; border-radius:5px 7px 3px 3px"></div><div style="position:absolute; left:32px; bottom:30px; width:2.5px; height:13px; background:currentColor; transform:rotate(20deg)"></div><div style="position:absolute; left:37px; bottom:31px; width:2.5px; height:10px; background:currentColor; transform:rotate(40deg)"></div></div>
        <!--slot:embers-->
      </div>

      <div data-par="0.26" style="position:absolute; left:0; top:0; width:6400px; height:810px; color:#000105; pointer-events:none">
        <svg viewBox="0 0 6400 810" preserveAspectRatio="none" style="position:absolute; left:0; top:0; width:6400px; height:810px">
          <path data-ridge="3" d="M0 762.6 L25 763.3 L50 763.9 L75 764.4 L100 764.7 L125 764.8 L150 764.7 L175 764.6 L200 764.2 L225 763.8 L250 763.4 L275 762.9 L300 762.4 L325 762.0 L350 761.6 L375 761.3 L400 761.0 L425 760.8 L450 760.5 L475 760.3 L500 760.1 L525 759.7 L550 759.3 L575 758.8 L600 758.1 L625 757.2 L650 756.1 L675 754.9 L700 753.6 L725 752.1 L750 750.5 L775 748.9 L800 747.2 L825 745.6 L850 744.1 L875 742.8 L900 741.6 L925 740.6 L950 739.9 L975 739.3 L1000 739.0 L1025 738.9 L1050 739.0 L1075 739.2 L1100 739.6 L1125 740.0 L1150 740.4 L1175 740.8 L1200 741.2 L1225 741.5 L1250 741.8 L1275 741.9 L1300 742.0 L1325 742.0 L1350 742.0 L1375 741.9 L1400 741.9 L1425 741.9 L1450 742.0 L1475 742.2 L1500 742.5 L1525 742.8 L1550 743.4 L1575 744.0 L1600 744.7 L1625 745.4 L1650 746.2 L1675 746.9 L1700 747.6 L1725 748.2 L1750 748.6 L1775 748.9 L1800 749.0 L1825 749.0 L1850 748.7 L1875 748.3 L1900 747.8 L1925 747.1 L1950 746.4 L1975 745.7 L2000 745.0 L2025 744.4 L2050 744.0 L2075 743.7 L2100 743.5 L2125 743.6 L2150 743.8 L2175 744.3 L2200 744.9 L2225 745.6 L2250 746.5 L2275 747.4 L2300 748.4 L2325 749.4 L2350 750.3 L2375 751.2 L2400 752.0 L2425 752.7 L2450 753.4 L2475 753.9 L2500 754.4 L2525 754.9 L2550 755.4 L2575 755.9 L2600 756.5 L2625 757.2 L2650 757.9 L2675 758.8 L2700 759.8 L2725 760.8 L2750 762.0 L2775 763.2 L2800 764.4 L2825 765.6 L2850 766.7 L2875 767.7 L2900 768.5 L2925 769.1 L2950 769.5 L2975 769.7 L3000 769.6 L3025 769.3 L3050 768.8 L3075 768.0 L3100 767.1 L3125 766.1 L3150 765.1 L3175 764.0 L3200 762.9 L3225 761.8 L3250 760.9 L3275 760.1 L3300 759.4 L3325 758.8 L3350 758.3 L3375 757.9 L3400 757.6 L3425 757.4 L3450 757.2 L3475 756.9 L3500 756.6 L3525 756.2 L3550 755.8 L3575 755.2 L3600 754.6 L3625 753.9 L3650 753.2 L3675 752.4 L3700 751.7 L3725 751.0 L3750 750.4 L3775 749.9 L3800 749.5 L3825 749.3 L3850 749.3 L3875 749.4 L3900 749.7 L3925 750.1 L3950 750.6 L3975 751.2 L4000 751.8 L4025 752.3 L4050 752.8 L4075 753.1 L4100 753.3 L4125 753.3 L4150 753.1 L4175 752.7 L4200 752.1 L4225 751.4 L4250 750.5 L4275 749.5 L4300 748.4 L4325 747.2 L4350 746.1 L4375 745.1 L4400 744.1 L4425 743.2 L4450 742.5 L4475 741.9 L4500 741.4 L4525 741.0 L4550 740.8 L4575 740.6 L4600 740.4 L4625 740.2 L4650 740.1 L4675 739.8 L4700 739.6 L4725 739.2 L4750 738.8 L4775 738.4 L4800 737.9 L4825 737.4 L4850 737.0 L4875 736.6 L4900 736.4 L4925 736.2 L4950 736.3 L4975 736.6 L5000 737.1 L5025 737.8 L5050 738.7 L5075 739.9 L5100 741.2 L5125 742.6 L5150 744.2 L5175 745.8 L5200 747.3 L5225 748.9 L5250 750.3 L5275 751.6 L5300 752.7 L5325 753.7 L5350 754.5 L5375 755.1 L5400 755.5 L5425 755.9 L5450 756.1 L5475 756.2 L5500 756.3 L5525 756.4 L5550 756.6 L5575 756.7 L5600 757.0 L5625 757.3 L5650 757.7 L5675 758.2 L5700 758.6 L5725 759.1 L5750 759.6 L5775 760.0 L5800 760.3 L5825 760.5 L5850 760.6 L5875 760.5 L5900 760.3 L5925 759.9 L5950 759.5 L5975 758.9 L6000 758.3 L6025 757.6 L6050 757.0 L6075 756.5 L6100 756.1 L6125 755.8 L6150 755.7 L6175 755.8 L6200 756.1 L6225 756.5 L6250 757.2 L6275 758.0 L6300 758.8 L6325 759.8 L6350 760.8 L6375 761.7 L6400 762.6 L6400 810 L0 810 Z" fill="#06091a"></path>
          <path data-ridge="4" d="M0 791.0 L25 792.0 L50 793.0 L75 794.0 L100 795.0 L125 796.0 L150 796.8 L175 797.6 L200 798.3 L225 799.0 L250 799.5 L275 799.9 L300 800.1 L325 800.3 L350 800.3 L375 800.3 L400 800.1 L425 799.9 L450 799.6 L475 799.2 L500 798.8 L525 798.3 L550 797.9 L575 797.4 L600 796.9 L625 796.5 L650 796.0 L675 795.7 L700 795.3 L725 795.1 L750 794.8 L775 794.7 L800 794.6 L825 794.5 L850 794.5 L875 794.5 L900 794.5 L925 794.6 L950 794.6 L975 794.7 L1000 794.7 L1025 794.6 L1050 794.5 L1075 794.4 L1100 794.2 L1125 793.9 L1150 793.5 L1175 793.1 L1200 792.6 L1225 792.0 L1250 791.3 L1275 790.6 L1300 789.8 L1325 789.0 L1350 788.2 L1375 787.3 L1400 786.5 L1425 785.7 L1450 784.9 L1475 784.2 L1500 783.6 L1525 783.1 L1550 782.6 L1575 782.3 L1600 782.1 L1625 782.0 L1650 782.1 L1675 782.2 L1700 782.5 L1725 782.9 L1750 783.4 L1775 784.0 L1800 784.7 L1825 785.5 L1850 786.3 L1875 787.2 L1900 788.1 L1925 788.9 L1950 789.8 L1975 790.7 L2000 791.5 L2025 792.2 L2050 792.9 L2075 793.5 L2100 794.0 L2125 794.5 L2150 794.8 L2175 795.1 L2200 795.3 L2225 795.4 L2250 795.5 L2275 795.5 L2300 795.5 L2325 795.4 L2350 795.4 L2375 795.3 L2400 795.2 L2425 795.2 L2450 795.1 L2475 795.1 L2500 795.2 L2525 795.3 L2550 795.5 L2575 795.7 L2600 796.0 L2625 796.3 L2650 796.6 L2675 797.0 L2700 797.4 L2725 797.9 L2750 798.3 L2775 798.6 L2800 799.0 L2825 799.3 L2850 799.6 L2875 799.7 L2900 799.8 L2925 799.8 L2950 799.7 L2975 799.5 L3000 799.1 L3025 798.7 L3050 798.1 L3075 797.5 L3100 796.7 L3125 795.9 L3150 795.0 L3175 794.0 L3200 793.0 L3225 792.0 L3250 791.0 L3275 790.0 L3300 789.0 L3325 788.0 L3350 787.2 L3375 786.4 L3400 785.7 L3425 785.0 L3450 784.5 L3475 784.1 L3500 783.9 L3525 783.7 L3550 783.7 L3575 783.7 L3600 783.9 L3625 784.1 L3650 784.4 L3675 784.8 L3700 785.2 L3725 785.7 L3750 786.1 L3775 786.6 L3800 787.1 L3825 787.5 L3850 788.0 L3875 788.3 L3900 788.7 L3925 788.9 L3950 789.2 L3975 789.3 L4000 789.4 L4025 789.5 L4050 789.5 L4075 789.5 L4100 789.5 L4125 789.4 L4150 789.4 L4175 789.3 L4200 789.3 L4225 789.4 L4250 789.5 L4275 789.6 L4300 789.8 L4325 790.1 L4350 790.5 L4375 790.9 L4400 791.4 L4425 792.0 L4450 792.7 L4475 793.4 L4500 794.2 L4525 795.0 L4550 795.8 L4575 796.7 L4600 797.5 L4625 798.3 L4650 799.1 L4675 799.8 L4700 800.4 L4725 800.9 L4750 801.4 L4775 801.7 L4800 801.9 L4825 802.0 L4850 801.9 L4875 801.8 L4900 801.5 L4925 801.1 L4950 800.6 L4975 800.0 L5000 799.3 L5025 798.5 L5050 797.7 L5075 796.8 L5100 795.9 L5125 795.1 L5150 794.2 L5175 793.3 L5200 792.5 L5225 791.8 L5250 791.1 L5275 790.5 L5300 790.0 L5325 789.5 L5350 789.2 L5375 788.9 L5400 788.7 L5425 788.6 L5450 788.5 L5475 788.5 L5500 788.5 L5525 788.6 L5550 788.6 L5575 788.7 L5600 788.8 L5625 788.8 L5650 788.9 L5675 788.9 L5700 788.8 L5725 788.7 L5750 788.5 L5775 788.3 L5800 788.0 L5825 787.7 L5850 787.4 L5875 787.0 L5900 786.6 L5925 786.1 L5950 785.7 L5975 785.4 L6000 785.0 L6025 784.7 L6050 784.4 L6075 784.3 L6100 784.2 L6125 784.2 L6150 784.3 L6175 784.5 L6200 784.9 L6225 785.3 L6250 785.9 L6275 786.5 L6300 787.3 L6325 788.1 L6350 789.0 L6375 790.0 L6400 791.0 L6400 810 L0 810 Z" fill="#02040c"></path>
        </svg>
        <div style="position:absolute; left:176px; top:535px; width:64px; height:232px; background:currentColor; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:248px; top:589px; width:50px; height:176px; background:currentColor; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 1.4s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:300px; top:630px; width:26px; height:134px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite">
      <div style="position:absolute; left:11.5px; bottom:0; width:3px; height:17.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:9.4px; width:26px; height:124.6px; background:currentColor; border-radius:13px 13px 7.3px 7.3px / 77.7px 77.7px 13.4px 13.4px"></div>
    </div>
        <div style="position:absolute; left:338px; top:672px; width:29px; height:92px; background:currentColor; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:900px; top:652px; width:64px; height:92px">
      <div style="position:absolute; left:29.5px; bottom:0; width:5px; height:40.5px; background:currentColor"></div>
      <div style="position:absolute; left:19.2px; bottom:29.4px; width:3px; height:20.2px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:42.2px; bottom:29.4px; width:3px; height:20.2px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:64px; height:58.9px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 0.9s infinite">
        <div style="position:absolute; left:8.3px; top:5.3px; width:39.7px; height:40.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:17.1px; width:30.7px; height:34.2px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:27.5px; top:13.5px; width:36.5px; height:36.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:17.3px; top:0px; width:29.4px; height:28.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:36.5px; top:25.3px; width:27.5px; height:26.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:3.2px; top:26.5px; width:26.9px; height:25.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:19.2px; top:29.4px; width:25.6px; height:23.6px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:980px; top:679px; width:46px; height:62px">
      <div style="position:absolute; left:20.5px; bottom:0; width:5px; height:27.3px; background:currentColor"></div>
      <div style="position:absolute; left:13.8px; bottom:19.8px; width:3px; height:13.6px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:30.4px; bottom:19.8px; width:3px; height:13.6px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:46px; height:39.7px; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 1.8s infinite">
        <div style="position:absolute; left:6px; top:3.6px; width:28.5px; height:27px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:11.5px; width:22.1px; height:23px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:19.8px; top:9.1px; width:26.2px; height:24.6px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:12.4px; top:0px; width:21.2px; height:19.1px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:26.2px; top:17.1px; width:19.8px; height:17.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:2.3px; top:17.9px; width:19.3px; height:17.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:13.8px; top:19.9px; width:18.4px; height:15.9px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:1320px; top:616px; width:72px; height:128px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out infinite">
      <div style="position:absolute; left:34px; bottom:0; width:4px; height:128px; background:currentColor"></div>
      <div style="position:absolute; left:34px; bottom:64px; width:31.7px; height:3px; background:currentColor; transform:rotate(-36deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:14.4px; bottom:53.8px; width:28.1px; height:3px; background:currentColor; transform:rotate(32deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:34px; bottom:92.2px; width:24.5px; height:3px; background:currentColor; transform:rotate(-24deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:14.4px; bottom:84.5px; width:20.9px; height:2px; background:currentColor; transform:rotate(26deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:34px; bottom:110.1px; width:17.3px; height:2px; background:currentColor; transform:rotate(-30deg); transform-origin:left bottom"></div>
    </div>
        <div style="position:absolute; left:1560px; top:508px; width:66px; height:238px; background:currentColor; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1642px; top:566px; width:52px; height:182px; background:currentColor; transform-origin:bottom center; animation:mrSway 9.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:1700px; top:600px; width:30px; height:150px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:13.5px; bottom:0; width:3px; height:19.5px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:10.5px; width:30px; height:139.5px; background:currentColor; border-radius:15px 15px 8.4px 8.4px / 87px 87px 15px 15px"></div>
    </div>
        <div style="position:absolute; left:2280px; top:642px; width:72px; height:108px; transform-origin:bottom center; animation:mrSway 9.0s ease-in-out 0.6s infinite">
      <div style="position:absolute; left:31.7px; bottom:0; width:6.5px; height:79.9px; background:currentColor; border-radius:2px; transform:rotate(4deg); transform-origin:bottom center"></div>
      <div style="position:absolute; left:35.3px; top:20.5px; width:38.9px; height:9.7px; background:currentColor; border-radius:19.4px 19.4px 10.9px 10.9px; transform-origin:left center; transform:rotate(-76deg)"></div>
      <div style="position:absolute; left:35.3px; top:20.5px; width:38.9px; height:9.7px; background:currentColor; border-radius:19.4px 19.4px 10.9px 10.9px; transform-origin:left center; transform:rotate(-42deg)"></div>
      <div style="position:absolute; left:35.3px; top:20.5px; width:38.9px; height:9.7px; background:currentColor; border-radius:19.4px 19.4px 10.9px 10.9px; transform-origin:left center; transform:rotate(-14deg)"></div>
      <div style="position:absolute; left:35.3px; top:20.5px; width:38.9px; height:9.7px; background:currentColor; border-radius:19.4px 19.4px 10.9px 10.9px; transform-origin:left center; transform:rotate(14deg)"></div>
      <div style="position:absolute; left:35.3px; top:20.5px; width:38.9px; height:9.7px; background:currentColor; border-radius:19.4px 19.4px 10.9px 10.9px; transform-origin:left center; transform:rotate(42deg)"></div>
      <div style="position:absolute; left:35.3px; top:20.5px; width:38.9px; height:9.7px; background:currentColor; border-radius:19.4px 19.4px 10.9px 10.9px; transform-origin:left center; transform:rotate(76deg)"></div>
      <div style="position:absolute; left:29.5px; top:17.3px; width:13px; height:8.6px; border-radius:50%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:2700px; top:612px; width:44px; height:150px; background:currentColor; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 2.1s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:3120px; top:656px; width:66px; height:112px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out infinite">
      <div style="position:absolute; left:31px; bottom:0; width:4px; height:112px; background:currentColor"></div>
      <div style="position:absolute; left:31px; bottom:56px; width:29px; height:3px; background:currentColor; transform:rotate(-36deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:13.2px; bottom:47px; width:25.7px; height:3px; background:currentColor; transform:rotate(32deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:31px; bottom:80.6px; width:22.4px; height:3px; background:currentColor; transform:rotate(-24deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:13.2px; bottom:73.9px; width:19.1px; height:2px; background:currentColor; transform:rotate(26deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:31px; bottom:96.3px; width:15.8px; height:2px; background:currentColor; transform:rotate(-30deg); transform-origin:left bottom"></div>
    </div>
        <div style="position:absolute; left:3480px; top:681px; width:56px; height:78px">
      <div style="position:absolute; left:25.5px; bottom:0; width:5px; height:34.3px; background:currentColor"></div>
      <div style="position:absolute; left:16.8px; bottom:25px; width:3px; height:17.2px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:37px; bottom:25px; width:3px; height:17.2px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:56px; height:49.9px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite">
        <div style="position:absolute; left:7.3px; top:4.5px; width:34.7px; height:33.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:14.5px; width:26.9px; height:28.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:24.1px; top:11.5px; width:31.9px; height:30.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:15.1px; top:0px; width:25.8px; height:24px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:31.9px; top:21.5px; width:24.1px; height:22.5px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:2.8px; top:22.5px; width:23.5px; height:22px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:16.8px; top:24.9px; width:22.4px; height:20px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:3860px; top:571px; width:52px; height:180px; background:currentColor; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:3924px; top:614px; width:28px; height:138px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:12.5px; bottom:0; width:3px; height:17.9px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:9.7px; width:28px; height:128.3px; background:currentColor; border-radius:14px 14px 7.8px 7.8px / 80px 80px 13.8px 13.8px"></div>
    </div>
        <div style="position:absolute; left:4300px; top:656px; width:29px; height:94px; background:currentColor; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.7s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:4680px; top:646px; width:66px; height:96px; transform-origin:bottom center; animation:mrSway 10.0s ease-in-out 1.2s infinite">
      <div style="position:absolute; left:29px; bottom:0; width:5.9px; height:71px; background:currentColor; border-radius:2px; transform:rotate(4deg); transform-origin:bottom center"></div>
      <div style="position:absolute; left:32.3px; top:18.2px; width:35.6px; height:8.6px; background:currentColor; border-radius:17.8px 17.8px 10px 10px; transform-origin:left center; transform:rotate(-76deg)"></div>
      <div style="position:absolute; left:32.3px; top:18.2px; width:35.6px; height:8.6px; background:currentColor; border-radius:17.8px 17.8px 10px 10px; transform-origin:left center; transform:rotate(-42deg)"></div>
      <div style="position:absolute; left:32.3px; top:18.2px; width:35.6px; height:8.6px; background:currentColor; border-radius:17.8px 17.8px 10px 10px; transform-origin:left center; transform:rotate(-14deg)"></div>
      <div style="position:absolute; left:32.3px; top:18.2px; width:35.6px; height:8.6px; background:currentColor; border-radius:17.8px 17.8px 10px 10px; transform-origin:left center; transform:rotate(14deg)"></div>
      <div style="position:absolute; left:32.3px; top:18.2px; width:35.6px; height:8.6px; background:currentColor; border-radius:17.8px 17.8px 10px 10px; transform-origin:left center; transform:rotate(42deg)"></div>
      <div style="position:absolute; left:32.3px; top:18.2px; width:35.6px; height:8.6px; background:currentColor; border-radius:17.8px 17.8px 10px 10px; transform-origin:left center; transform:rotate(76deg)"></div>
      <div style="position:absolute; left:27.1px; top:15.4px; width:11.9px; height:7.7px; border-radius:50%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:5060px; top:585px; width:46px; height:156px; background:currentColor; transform-origin:bottom center; animation:mrSway 9.0s ease-in-out 1.4s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:5114px; top:628px; width:24px; height:116px; transform-origin:bottom center; animation:mrSway 12.0s ease-in-out 0.8s infinite">
      <div style="position:absolute; left:10.5px; bottom:0; width:3px; height:15.1px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:8.1px; width:24px; height:107.9px; background:currentColor; border-radius:12px 12px 6.7px 6.7px / 67.3px 67.3px 11.6px 11.6px"></div>
    </div>
        <div style="position:absolute; left:5480px; top:638px; width:70px; height:120px; transform-origin:bottom center; animation:mrSway 15.0s ease-in-out infinite">
      <div style="position:absolute; left:33px; bottom:0; width:4px; height:120px; background:currentColor"></div>
      <div style="position:absolute; left:33px; bottom:60px; width:30.8px; height:3px; background:currentColor; transform:rotate(-36deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:14px; bottom:50.4px; width:27.3px; height:3px; background:currentColor; transform:rotate(32deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:33px; bottom:86.4px; width:23.8px; height:3px; background:currentColor; transform:rotate(-24deg); transform-origin:left bottom"></div>
      <div style="position:absolute; left:14px; bottom:79.2px; width:20.3px; height:2px; background:currentColor; transform:rotate(26deg); transform-origin:right bottom"></div>
      <div style="position:absolute; left:33px; bottom:103.2px; width:16.8px; height:2px; background:currentColor; transform:rotate(-30deg); transform-origin:left bottom"></div>
    </div>
        <div style="position:absolute; left:5860px; top:595px; width:50px; height:168px; background:currentColor; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 2.8s infinite; clip-path:polygon(50% 0%,58% 13%,52.5% 13%,64% 29%,57% 29%,70.5% 47%,61% 47%,77% 67%,64% 67%,83% 88%,55.5% 88%,55.5% 100%,44.5% 100%,44.5% 88%,17% 88%,36% 67%,23% 67%,39% 47%,29.5% 47%,43% 29%,36% 29%,47.5% 13%,42% 13%)"></div>
        <div style="position:absolute; left:5920px; top:636px; width:26px; height:126px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 0.0s infinite">
      <div style="position:absolute; left:11.5px; bottom:0; width:3px; height:16.4px; background:currentColor"></div>
      <div style="position:absolute; left:0; bottom:8.8px; width:26px; height:117.2px; background:currentColor; border-radius:13px 13px 7.3px 7.3px / 73.1px 73.1px 12.6px 12.6px"></div>
    </div>
        <div style="position:absolute; left:6260px; top:671px; width:62px; height:88px">
      <div style="position:absolute; left:28.5px; bottom:0; width:5px; height:38.7px; background:currentColor"></div>
      <div style="position:absolute; left:18.6px; bottom:28.2px; width:3px; height:19.4px; background:currentColor; transform:rotate(30deg)"></div>
      <div style="position:absolute; left:40.9px; bottom:28.2px; width:3px; height:19.4px; background:currentColor; transform:rotate(-30deg)"></div>
      <div style="position:absolute; left:0; top:0; width:62px; height:56.3px; transform-origin:bottom center; animation:mrSway 11.0s ease-in-out 1.8s infinite">
        <div style="position:absolute; left:8.1px; top:5.1px; width:38.4px; height:38.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:0px; top:16.3px; width:29.8px; height:32.7px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:26.7px; top:12.9px; width:35.3px; height:34.9px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:16.7px; top:0px; width:28.5px; height:27px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:35.3px; top:24.2px; width:26.7px; height:25.3px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:3.1px; top:25.3px; width:26px; height:24.8px; border-radius:50%; background:currentColor"></div>
        <div style="position:absolute; left:18.6px; top:28.1px; width:24.8px; height:22.5px; border-radius:50%; background:currentColor"></div>
      </div>
    </div>
        <div style="position:absolute; left:520px; top:728px; width:86px; height:34px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:700px; top:722px; width:54px; height:34px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 1s infinite">
      <div style="position:absolute; left:0; bottom:0; width:30.2px; height:27.9px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:18.4px; bottom:0; width:27px; height:34px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:33.5px; bottom:0; width:20.5px; height:23.8px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:1180px; top:715px; width:70px; height:28px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div style="position:absolute; left:1900px; top:712px; width:58px; height:38px; transform-origin:bottom center; animation:mrSway 15.0s ease-in-out 2s infinite">
      <div style="position:absolute; left:0; bottom:0; width:32.5px; height:31.2px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:19.7px; bottom:0; width:29px; height:38px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:36px; bottom:0; width:22px; height:26.6px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:2160px; top:710px; width:92px; height:36px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:3000px; top:740px; width:50px; height:32px; transform-origin:bottom center; animation:mrSway 13.0s ease-in-out 0s infinite">
      <div style="position:absolute; left:0; bottom:0; width:28px; height:26.2px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:17px; bottom:0; width:25px; height:32px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:31px; bottom:0; width:19px; height:22.4px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:3300px; top:731px; width:76px; height:30px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div style="position:absolute; left:4100px; top:719px; width:56px; height:36px; transform-origin:bottom center; animation:mrSway 14.0s ease-in-out 1s infinite">
      <div style="position:absolute; left:0; bottom:0; width:31.4px; height:29.5px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:19px; bottom:0; width:28px; height:36px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:34.7px; bottom:0; width:21.3px; height:25.2px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:4500px; top:711px; width:84px; height:32px; background:currentColor; clip-path:polygon(0% 100%,14% 46%,38% 22%,58% 8%,78% 26%,94% 58%,100% 100%)"></div>
        <div style="position:absolute; left:5300px; top:721px; width:52px; height:34px; transform-origin:bottom center; animation:mrSway 15.0s ease-in-out 2s infinite">
      <div style="position:absolute; left:0; bottom:0; width:29.1px; height:27.9px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:17.7px; bottom:0; width:26px; height:34px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
      <div style="position:absolute; left:32.2px; bottom:0; width:19.8px; height:23.8px; border-radius:50% 50% 40% 40%; background:currentColor"></div>
    </div>
        <div style="position:absolute; left:5700px; top:732px; width:72px; height:29px; background:currentColor; clip-path:polygon(0% 100%,10% 52%,30% 18%,52% 4%,70% 20%,88% 48%,100% 100%)"></div>
        <div style="position:absolute; left:440px; top:737px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:18.2px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:26px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:14.3px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:22.1px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:1440px; top:720px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:16.8px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:24px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:13.2px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:20.4px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 11.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:2600px; top:731px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:19.6px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 6.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:28px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:15.4px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:23.8px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:3700px; top:729px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:17.5px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:25px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:13.8px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:21.3px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:4900px; top:711px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:18.9px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:27px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:14.9px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 10.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:22.9px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 11.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:6100px; top:732px; display:flex; align-items:flex-end; gap:4px">
      <div style="width:3px; height:18.2px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 6.0s ease-in-out 0.0s infinite"></div><div style="width:3px; height:26px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 7.0s ease-in-out 0.4s infinite"></div><div style="width:3px; height:14.3px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 8.0s ease-in-out 0.8s infinite"></div><div style="width:3px; height:22.1px; background:currentColor; border-radius:3px; transform-origin:bottom; animation:mrSway 9.0s ease-in-out 1.2s infinite"></div>
    </div>
        <div style="position:absolute; left:2480px; top:736px; display:flex; align-items:flex-end; gap:15px"><div style="position:relative; width:29px; height:17px; background:currentColor; border-radius:14.5px 14.5px 4px 4px"><div style="position:absolute; left:24px; top:-7px; width:9px; height:9px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div><div style="position:relative; width:25px; height:14px; background:currentColor; border-radius:12.5px 12.5px 4px 4px"><div style="position:absolute; left:20px; top:-6px; width:8px; height:8px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div><div style="position:relative; width:21px; height:12px; background:currentColor; border-radius:10.5px 10.5px 4px 4px"><div style="position:absolute; left:16px; top:-5px; width:6px; height:6px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div><div style="position:relative; width:17px; height:10px; background:currentColor; border-radius:8.5px 8.5px 4px 4px"><div style="position:absolute; left:12px; top:-4px; width:5px; height:5px; border-radius:50%; background:currentColor"></div><div style="position:absolute; left:2px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div><div style="position:absolute; right:3px; bottom:-4px; width:2.5px; height:5px; background:currentColor"></div></div></div><div style="position:absolute; left:2600px; top:713px; width:20px; height:46px"><div style="position:absolute; left:3px; top:9px; width:12px; height:37px; background:currentColor; border-radius:6px 6px 2px 2px"></div><div style="position:absolute; left:4px; top:0; width:10px; height:11px; border-radius:50% 50% 44% 44%; background:currentColor"></div><div style="position:absolute; left:16px; top:-10px; width:3px; height:56px; background:currentColor; transform:rotate(7deg); transform-origin:bottom center; animation:mrSway 10s ease-in-out infinite"></div></div>
        <div style="position:absolute; left:4020px; top:718px; width:46px; height:36px"><div style="position:absolute; left:0; bottom:7px; width:32px; height:16px; background:currentColor; border-radius:10px 13px 5px 5px"></div><div style="position:absolute; left:3px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:11px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:26px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:22px; bottom:14px; width:4px; height:12px; background:currentColor; transform:rotate(-16deg)"></div><div style="position:absolute; left:26px; bottom:22px; width:11px; height:11px; background:currentColor; border-radius:5px 7px 3px 3px"></div><div style="position:absolute; left:32px; bottom:30px; width:2.5px; height:13px; background:currentColor; transform:rotate(20deg)"></div><div style="position:absolute; left:37px; bottom:31px; width:2.5px; height:10px; background:currentColor; transform:rotate(40deg)"></div></div><div style="position:absolute; left:6060px; top:727px; display:flex; align-items:flex-end; gap:22px"><div style="position:relative; width:48px; height:32px"><div style="position:absolute; left:0; bottom:8px; width:34px; height:12px; background:currentColor; border-radius:8px 10px 4px 4px"></div><div style="position:absolute; left:6px; bottom:17px; width:11px; height:9px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:18px; bottom:17px; width:11px; height:8px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:30px; bottom:14px; width:4px; height:15px; background:currentColor; transform:rotate(-13deg)"></div><div style="position:absolute; left:31px; bottom:26px; width:10px; height:6px; background:currentColor; border-radius:3px"></div><div style="position:absolute; left:3px; bottom:0; width:3px; height:10px; background:currentColor"></div><div style="position:absolute; left:26px; bottom:0; width:3px; height:10px; background:currentColor"></div></div><div style="position:relative; width:41px; height:27px"><div style="position:absolute; left:0; bottom:8px; width:29px; height:10px; background:currentColor; border-radius:7px 9px 4px 4px"></div><div style="position:absolute; left:5px; bottom:14px; width:9px; height:8px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:15px; bottom:14px; width:9px; height:7px; background:currentColor; border-radius:50% 50% 0 0"></div><div style="position:absolute; left:26px; bottom:12px; width:3px; height:13px; background:currentColor; transform:rotate(-13deg)"></div><div style="position:absolute; left:26px; bottom:22px; width:9px; height:5px; background:currentColor; border-radius:3px"></div><div style="position:absolute; left:3px; bottom:0; width:3px; height:9px; background:currentColor"></div><div style="position:absolute; left:22px; bottom:0; width:3px; height:9px; background:currentColor"></div></div></div>
      </div>

      <div data-moonlight="1" style="position:absolute; left:1200px; top:414px; width:1900px; height:1500px; transform:translate(-50%,-50%); background:radial-gradient(ellipse at center,rgba(174,202,255,.3) 0%,rgba(150,184,255,.14) 26%,rgba(130,168,250,.05) 48%,rgba(120,160,250,0) 70%); mix-blend-mode:screen; pointer-events:none"></div>

      <div data-bottomdark="1" style="position:absolute; left:0; right:0; bottom:0; height:300px; background:linear-gradient(180deg,rgba(1,3,10,0) 0%,rgba(1,3,10,.42) 52%,rgba(1,3,10,.74) 100%); pointer-events:none"></div>

      <div data-haze="1" style="position:absolute; left:0; right:0; bottom:0; height:360px; background:linear-gradient(180deg,rgba(96,134,220,0) 0%,rgba(70,106,200,.1) 58%,rgba(52,86,176,.18) 100%); pointer-events:none"></div>

      <div data-night="1" style="position:absolute; inset:0; opacity:1; pointer-events:none">
        <!--slot:fireflies-->
      </div>

      <!--slot:motes-->
`;

export const ROAD_HTML = `      <div data-roadwrap="1" style="position:absolute; inset:0; overflow:hidden; cursor:grab; mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 300px,rgba(0,0,0,.5) 420px,#000 560px); -webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 300px,rgba(0,0,0,.5) 420px,#000 560px)">
        <div data-road="1" style="position:absolute; left:0; top:0; width:6200px; height:810px; will-change:transform">
          
                    <svg viewBox="0 0 6200 810" preserveAspectRatio="none" style="position:absolute; left:0; top:0; width:6200px; height:810px; pointer-events:none">
            <path data-roadglow="1" d="" fill="none" stroke="#ffe0a8" stroke-opacity="0.13" stroke-width="26" stroke-linecap="round"></path>
            <path data-roadline="1" d="" fill="none" stroke="#fff3d6" stroke-opacity="0.55" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="2 12" style="animation:mrDash 4s linear infinite"></path>
            <path data-roadwalked="1" d="" fill="none" stroke="#ffd28a" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round"></path>
          </svg>

          <!--slot:nodes-->
        </div>
      </div>`;

export const VIGNETTE_HTML = `      <div style="position:absolute; inset:0; background:radial-gradient(124% 90% at 50% 40%, rgba(0,0,0,0) 40%, rgba(1,3,10,.62) 100%); pointer-events:none"></div>`;
