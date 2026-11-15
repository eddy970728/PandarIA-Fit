# PandarIA Fit en iPhone y iPad (con AltStore desde Windows)

La versión de iPhone no está en el App Store. Se compila en GitHub como **PandarIA-Fit.ipa sin firmar** y la instalas tú con **AltStore**, que la firma con tu Apple ID gratis.

## Lo que necesitas

- Un PC con Windows 10 u 11.
- El iPhone o iPad y su cable USB.
- Tu Apple ID. Puedes usar el tuyo de siempre o crear uno solo para esto.
- **iTunes** e **iCloud** descargados de la web de Apple, *no* de la Microsoft Store. AltServer necesita esas versiones:
  - https://www.apple.com/itunes/download/win64
  - https://support.apple.com/es-es/HT204283

## 1. Instala AltServer en el PC

1. Descarga AltServer para Windows desde https://altstore.io e instálalo.
2. Abre AltServer. Aparece como un rombo junto al reloj, abajo a la derecha.

## 2. Instala AltStore en el iPhone

1. Conecta el iPhone al PC con el cable, desbloquéalo y pulsa **Confiar**.
2. En iTunes, abre tu iPhone y activa **Sincronizar con este iPhone vía Wi-Fi**. Pulsa **Aplicar**.
3. Haz clic en el rombo de AltServer › **Install AltStore** › tu iPhone. Escribe tu Apple ID y tu contraseña cuando los pida (solo se envían a Apple).
4. En el iPhone, ve a **Ajustes › General › VPN y gestión de dispositivos**, toca tu Apple ID y pulsa **Confiar**.
5. En iOS 16 o superior, activa además **Ajustes › Privacidad y seguridad › Modo de desarrollador** y reinicia cuando lo pida.

## 3. Descarga PandarIA-Fit.ipa

1. En GitHub, abre **Actions › Compilar app de iPhone (IPA sin firmar)**.
2. Entra en la última compilación con el círculo verde ✓ y descarga **PandarIA-Fit-iPhone-…** en *Artifacts*.
3. Descomprime el .zip. Dentro está **PandarIA-Fit.ipa**.
4. Pásala al iPhone por cualquiera de estas vías:
   - AirDrop desde un Mac;
   - iCloud Drive: arrastra el archivo a la carpeta iCloud Drive del PC y aparecerá en la app **Archivos** del iPhone;
   - correo o WhatsApp a ti mismo, y luego **Guardar en Archivos**.

## 4. Instala la app

1. Abre **AltStore** en el iPhone › pestaña **My Apps** › **+** arriba a la izquierda.
2. Elige **PandarIA-Fit.ipa** en Archivos.
3. Espera a que termine. El PC tiene que estar encendido con AltServer abierto y en la misma red Wi-Fi.

## Cada 7 días

Con un Apple ID gratuito, Apple hace caducar las apps instaladas así a los **7 días**.

- AltStore las renueva solo si el iPhone y el PC (con AltServer abierto) están en la misma Wi-Fi.
- También puedes renovarla a mano: AltStore › **My Apps** › **Refresh All**.

Tus datos no se pierden al renovar.

Para actualizar PandarIA Fit a una versión nueva, descarga la nueva .ipa y repite el paso 4. Se instala encima, sin borrar nada.

## Qué funciona en iPhone

| Funciona | No disponible en iPhone (por ahora) |
|---|---|
| Rutinas, entreno, PandarIA, Consulta, retos, nutrición, agua y ayuno | Widgets |
| Notificaciones (descanso, entreno, agua y ayuno)* | Notificación fija del entreno con botones |
| Voz, pantalla siempre encendida y vibración | Suscripción (llegará con el App Store; mientras tanto, Premium con código) |
| Apple Health: pasos, peso, pulso, sueño y variabilidad del pulso | Copia en Google Drive (hace falta crear un ID de cliente de iOS en Google Cloud) |
| Escáner de códigos de barras, fotos de progreso y compartir | |
| Copias y exportaciones en Archivos › En mi iPhone › PandarIA Fit | |

\* iPhone guarda como máximo 64 avisos programados, así que PandarIA deja los más próximos.

## Premium en iPhone

En **Premium › ¿No puedes pagarlo?** está tu código de teléfono. Envíaselo al creador y te mandará un código de regalo.

> Ojo: en iPhone, el código de teléfono cambia si borras la app y la vuelves a instalar.

## Si algo falla

- **«Could not find AnisetteData» o error de iCloud**: reinstala iTunes e iCloud desde la web de Apple (no desde la Microsoft Store).
- **«Maximum number of apps»**: un Apple ID gratuito permite 3 apps a la vez, y AltStore cuenta como una.
- **Apple Health no pide permiso** o aparece un error de *entitlement*: avisa al creador. Se puede hacer una versión sin Salud para tu cuenta.
- **La app no abre** después de 7 días: abre AltStore y pulsa **Refresh All** con el PC encendido.
