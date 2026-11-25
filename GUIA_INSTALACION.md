# Guia de los dos modulos de monitoreo

## Arquitectura

- **Modulo 1:** Particle Photon 1 + DHT11 + MQ-6. Publica sus lecturas por Wi-Fi en Particle Cloud; una integracion Webhook las reenvia a Netlify.
- **Modulo 2:** NodeMCU ESP8266 + DHT11 + MQ-2. Envia sus lecturas directamente por Wi-Fi a Netlify.
- **Pagina:** Netlify recibe y combina las actualizaciones independientes de ambos modulos. El panel no necesita que las placas se conecten fisicamente ni que una computadora permanezca encendida.

Cada modulo necesita alimentacion USB y acceso Wi-Fi con Internet. No requieren compartir cables, GND ni estar en la misma red local. El Photon debe estar conectado a Particle Cloud; el ESP8266 necesita las credenciales de una red Wi-Fi de 2.4 GHz.

Esta guia supone que tu ESP8266 es una **placa de desarrollo NodeMCU (ESP-12E/ESP-12F) con pin A0 apto para 0–3.3 V**. Si tienes un ESP-01 u otro modulo sin regulador/divisor integrado para A0, no conectes el MQ hasta confirmar el rango de su entrada analogica y adaptar el divisor.

## Componentes y alimentacion

- Particle Photon 1 y placa de desarrollo NodeMCU ESP8266.
- Dos DHT11 y modulos MQ-2 y MQ-6 con salida analogica `AO`.
- Fuente regulada de **5 V** para los modulos MQ. Reserva al menos 500 mA para cada calefactor MQ; usa una fuente con capacidad suficiente para ambos si comparten fuente.
- Cables y cuatro resistencias para los divisores de voltaje: dos de **10 kΩ** y dos de **20 kΩ**.
- Una fuente USB para cada placa.

Los calefactores de los MQ consumen bastante mas que un pin de 3.3 V. No los alimentes desde el pin 3V3 del Photon o del ESP8266. Alimenta cada placa por USB y los modulos MQ desde 5 V regulados. En cada esquina, une el GND de la placa con el GND de su sensor MQ y su fuente de 5 V. No unas el positivo de 5 V con los pines `3V3`, `A0` o `TX`. No hace falta conectar las tierras de una esquina con la otra.

### Conexion del modulo 1 — Photon 1

| Componente | Pin del componente | Conexion |
|---|---|---|
| DHT11 del modulo 1 | VCC | `3V3` del Photon |
| DHT11 del modulo 1 | DATA / OUT | `D2` del Photon |
| DHT11 del modulo 1 | GND | `GND` del Photon |
| MQ-6 | VCC | +5 V regulados |
| MQ-6 | GND | GND comun |
| MQ-6 | AO | Resistencia de 10 kΩ hacia `A0`; tambien al extremo superior del divisor de abajo |
| Divisor del MQ-6 | Nodo entre resistencias | `A0` del Photon |
| Divisor del MQ-6 | Resistencia de 20 kΩ | Entre `A0` y GND |

El divisor del MQ-6 queda asi: `MQ-6 AO → 10 kΩ → A0 del Photon → 20 kΩ → GND`. La Photon envia a la pagina la lectura analogica sin convertir: un entero ADC entre **0 y 4095**.

### Conexion del modulo 2 — NodeMCU ESP8266

| Componente | Pin del componente | Conexion |
|---|---|---|
| DHT11 del modulo 2 | VCC | `3V3` del NodeMCU |
| DHT11 del modulo 2 | DATA / OUT | `D1` del NodeMCU (GPIO5) |
| DHT11 del modulo 2 | GND | `GND` del NodeMCU |
| MQ-2 | VCC | +5 V regulados |
| MQ-2 | GND | GND comun |
| MQ-2 | AO | Resistencia de 10 kΩ hacia `A0`; tambien al extremo superior del divisor de abajo |
| Divisor del MQ-2 | Nodo entre resistencias | `A0` del NodeMCU |
| Divisor del MQ-2 | Resistencia de 20 kΩ | Entre `A0` y GND |

El divisor del MQ-2 queda asi: `MQ-2 AO → 10 kΩ → A0 del NodeMCU → 20 kΩ → GND`. La pagina muestra la lectura analogica sin convertir: un entero ADC entre **0 y 1023**. El NodeMCU envia los datos por Wi-Fi y no necesita cable USB de datos permanente despues de cargar su programa.

Los modulos DHT11 de tres pines suelen incluir la resistencia pull-up. Si tienes un DHT11 desnudo de cuatro pines, conecta una resistencia de **10 kΩ entre DATA y VCC**. Revisa las etiquetas de tu modulo antes de conectar; el orden fisico de los pines no es igual en todos.

**Antes de encender:** revisa GND en cada modulo, orientacion de cada DHT11 y los divisores. Nunca conectes la salida `AO` de un MQ directamente al pin analogico sin confirmar que no exceda el maximo admitido por tu placa.

## Instalacion y carga del programa

### Prueba local opcional

1. Instala Node.js 18 o posterior y ejecuta `node server.js` desde la carpeta del proyecto.
2. Abre la URL local que imprime el servidor, por ejemplo `http://localhost:3000`.
3. Para esta prueba, configura temporalmente el ESP8266 para enviar a `http://IP_DE_LA_COMPUTADORA:3000/api/readings`.

Esta prueba local solo recibe al ESP8266. Para ver ambos modulos independientes, usa el sitio Netlify y configura el webhook de Particle; la nube de Particle no puede enviar eventos a `localhost`.

### Publicar en Netlify

Para que `https://monitordeaire.site` muestre las lecturas reales, el proyecto usa una funcion Netlify en `netlify/functions/readings.js` y Netlify Blobs como almacenamiento compartido. Netlify no puede ejecutar `server.js` para el dominio publico.

1. Instala las dependencias desde PowerShell:

   ```powershell
   npm install
   npm install -g netlify-cli
   ```

2. Inicia sesion y despliega:

   ```powershell
   netlify login
   netlify init
   netlify deploy --prod
   ```

3. En Netlify, abre **Project configuration → Environment variables** y agrega `NETLIFY_BLOBS_TOKEN`. El valor debe ser un **Personal access token** de Netlify. Se crea desde la configuracion de usuario, en **Applications → Personal access tokens**. Guárdalo como variable secreta solo en Netlify; no lo pegues en el firmware, no lo envies por chat y no lo subas al repositorio. El ID del sitio ya esta configurado en la funcion.
4. Guarda la variable y dispara un nuevo deploy de produccion para que la funcion reciba la configuracion.
5. Cambia en `esp8266_modulo2/esp8266_modulo2.ino` `SERVER_URL` por `https://monitordeaire.site/api/readings`. Para pruebas locales puedes volver temporalmente a `http://IP_DE_LA_COMPUTADORA:3000/api/readings`.
6. El ESP8266 usa TLS en el firmware. Vuelve a cargarlo despues de cambiar la URL. Este firmware solo envia las lecturas del propio ESP8266.
7. Verifica la API publica en PowerShell:

   ```powershell
   Invoke-RestMethod https://monitordeaire.site/api/readings
   ```

El endpoint respondera con error `503` hasta que exista `NETLIFY_BLOBS_TOKEN` en las variables de entorno de produccion.

### Configurar el webhook de Particle

1. Entra a Particle Console y abre **Integrations** dentro de tu cuenta (Sandbox).
2. Crea una **Custom Webhook** e importa/pega la configuracion de `particle-webhook.json` usando **Custom Template**.
3. Guarda y habilita la integracion. Debe escuchar el evento exacto `photon-readings` y enviar un `POST` a `https://monitordeaire.site/api/readings`.
4. Comprueba en el historial de la integracion que las solicitudes terminen correctamente. El Photon publica una lectura cada 30 segundos; la pagina acepta y combina esos datos con los del ESP8266.

El webhook reenvia el JSON publicado por el Photon sin que este se conecte fisicamente al ESP8266 ni tenga que enviar directamente por HTTPS a Netlify.

### Cargar el programa del Photon

Puedes usar el **[Particle Web IDE](https://build.particle.io/)** desde el navegador:

1. Inicia sesion con tu cuenta Particle y crea o abre una app.
2. Abre `photon_modulo1/photon_modulo1.ino` con un editor de texto y copia su contenido en el archivo principal de la app del Web IDE.
3. En **Libraries**, agrega `Adafruit_DHT` a la app si aun no esta incluida.
4. En la seleccion de dispositivo, elige tu **Photon 1**. Para flashear desde la web, debe estar reclamada en tu cuenta y conectada a Particle Cloud (en linea).
5. Pulsa **Verify** para compilar y despues **Flash** para cargar el firmware al Photon por la nube. El programa usa `D2` para el DHT11 y `A0` para MQ-6; publica el evento `photon-readings` en Particle Cloud cada 30 segundos.

Si el Photon no aparece en linea o quieres cargarlo por USB, puedes usar **Particle Workbench** en Visual Studio Code: instala la extension, agrega `Adafruit_DHT`, conecta el Photon por USB y carga el firmware por USB/DFU. Despues, deja el Photon conectado a Wi-Fi y Particle Cloud para que el webhook pueda reenviar los eventos. Abre un monitor serial a 9600 baudios para revisar las lecturas.

### Cargar el programa del ESP8266

1. Instala Arduino IDE 2.x.
2. En **Preferencias → URLs adicionales de gestor de tarjetas**, agrega la URL del paquete ESP8266 de ESP8266 Community; despues, en el Gestor de tarjetas, instala **esp8266 by ESP8266 Community**.
3. En el Gestor de bibliotecas instala **DHT sensor library by Adafruit** y **Adafruit Unified Sensor**. `ESP8266WiFi` y `ESP8266HTTPClient` vienen con el paquete de tarjetas ESP8266.
4. Abre `esp8266_modulo2/esp8266_modulo2.ino`. En Arduino IDE, la carpeta del sketch y el archivo `.ino` deben conservar el mismo nombre.
5. En la parte superior del archivo reemplaza:
   - `WIFI_SSID` por el nombre exacto de tu Wi-Fi.
   - `WIFI_PASSWORD` por la clave de esa red.
   - `SERVER_URL` por `https://monitordeaire.site/api/readings` para el montaje final. Para una prueba local del ESP, puedes usar la IP que imprimio `node server.js`, conservando `:3000/api/readings`.
6. Selecciona la tarjeta **NodeMCU 1.0 (ESP-12E Module)** y el puerto USB correcto; compila y carga el programa.
7. Abre el Monitor serie a 115200 baudios. Debe mostrar que se conecto al Wi-Fi y respuestas `HTTP 200` al enviar lecturas.

Guarda las credenciales Wi-Fi solo en tu copia local del firmware y no publiques ese archivo con la clave.

## Comprobacion

Abre `https://monitordeaire.site` y enciende ambos modulos con sus fuentes USB. En unos segundos deben aparecer las lecturas del ESP8266; las del Photon se actualizan cada 30 segundos. El MQ-6 usa la escala ADC 0–4095 de la Photon y el MQ-2 la escala 0–1023 del NodeMCU. El ESP muestra `HTTP 200` cuando Netlify recibe su paquete. En Particle Console, el evento `photon-readings` y una entrega correcta del webhook confirman el recorrido del Photon.

Tambien puedes comprobar el servidor en PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/readings
```

La respuesta contiene las seis lecturas, `updatedAt` y el estado de frescura independiente de `modules.photon` y `modules.esp8266`.

## Lecturas MQ

El panel presenta directamente el conteo del convertidor analogico-digital (ADC) de cada placa; no lo transforma a porcentaje ni a ppm. Los MQ-2 y MQ-6 requieren calentamiento y calibracion para mediciones de concentracion. No uses este montaje como alarma de gas ni como sustituto de un detector certificado.

## Solucion de problemas

- **El panel no abre:** confirma que `node server.js` sigue ejecutandose y que el puerto 3000 esta disponible.
- **El ESP no se conecta:** revisa que `WIFI_SSID` y `WIFI_PASSWORD` en el firmware correspondan a la red actual (el ESP no cambia de red automáticamente), cobertura y que la red permita comunicacion entre dispositivos. Si el Monitor serie se queda en `Conectando a Wi-Fi`, todavía no está conectado.
- **El ESP no llega al servidor:** confirma que `SERVER_URL` sea `https://monitordeaire.site/api/readings` y revisa el codigo HTTP en el Monitor serie.
- **El panel público sigue sin datos:** abre `https://monitordeaire.site/api/readings`. Si la respuesta incluye `"stale":true`, no han llegado lecturas válidas recientemente; el `404` de `/favicon.ico` no es la causa. Revisa el Monitor serie del ESP: `HTTP 200` confirma que el servidor aceptó el envío; los errores HTTP muestran también el detalle de la respuesta. En el firmware actual, los sensores sin lectura válida se envían como `null` para que no invaliden el resto del paquete.
- **Temperatura/humedad aparece como `--`:** revisa DATA, VCC, GND, pull-up del DHT11 y espera al siguiente ciclo de lectura.
- **No llegan datos del Photon:** revisa que aparezca el evento `photon-readings` en Particle Console, que el Photon este conectado a Particle Cloud y que el webhook este habilitado. Si hay evento, pero no llega al sitio, revisa el resultado de entrega del webhook en Particle Console.
- **El valor MQ se queda en 0 o cambia poco:** espera el calentamiento indicado por el fabricante y revisa alimentacion de 5 V, AO, divisor y GND. No ajustes el divisor suponiendo que el ADC aguanta mas voltaje.
