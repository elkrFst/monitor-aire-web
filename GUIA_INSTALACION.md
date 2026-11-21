# Guia de los dos modulos de monitoreo

## Arquitectura

- **Modulo 1:** Particle Photon 1 + DHT11 + MQ-9. La Photon manda sus tres lecturas por un cable serial al ESP8266.
- **Modulo 2:** NodeMCU ESP8266 + DHT11 + MQ-2. El ESP8266 combina sus lecturas con las que recibe de la Photon y las envia por Wi-Fi a la computadora.
- **Pagina:** `server.js` sirve el panel en la computadora y recibe las lecturas en `http://IP_DE_LA_COMPUTADORA:3000/api/readings`. No usa Particle Cloud ni necesita un token en el navegador.

Esta guia supone que tu ESP8266 es una **placa de desarrollo NodeMCU (ESP-12E/ESP-12F) con pin A0 apto para 0–3.3 V**. Si tienes un ESP-01 u otro modulo sin regulador/divisor integrado para A0, no conectes el MQ hasta confirmar el rango de su entrada analogica y adaptar el divisor.

## Componentes y alimentacion

- Particle Photon 1 y placa de desarrollo NodeMCU ESP8266.
- Dos DHT11 y modulos MQ-2 y MQ-9 con salida analogica `AO`.
- Fuente regulada de **5 V** para los modulos MQ. Reserva al menos 500 mA para cada calefactor MQ; usa una fuente con capacidad suficiente para ambos si comparten fuente.
- Cables y cuatro resistencias para los divisores de voltaje: dos de **10 kΩ** y dos de **20 kΩ**.
- Cable USB para cada placa.

Los calefactores de los MQ consumen bastante mas que un pin de 3.3 V. No los alimentes desde el pin 3V3 del Photon o del ESP8266. Alimenta cada placa por USB y los modulos MQ desde 5 V regulados. Une las tierras (`GND`) de las dos placas y de la fuente de 5 V. No unas el positivo de 5 V con los pines `3V3`, `A0` o `TX`.

### Conexion del modulo 1 — Photon 1

| Componente | Pin del componente | Conexion |
|---|---|---|
| DHT11 del modulo 1 | VCC | `3V3` del Photon |
| DHT11 del modulo 1 | DATA / OUT | `D2` del Photon |
| DHT11 del modulo 1 | GND | `GND` del Photon |
| MQ-9 | VCC | +5 V regulados |
| MQ-9 | GND | GND comun |
| MQ-9 | AO | Resistencia de 10 kΩ hacia `A0`; tambien al extremo superior del divisor de abajo |
| Divisor del MQ-9 | Nodo entre resistencias | `A0` del Photon |
| Divisor del MQ-9 | Resistencia de 20 kΩ | Entre `A0` y GND |
| Serial Photon → ESP8266 | `TX` del Photon | `D5` del NodeMCU (GPIO14, entrada serial del ESP) |
| Referencia serial | `GND` del Photon | GND del NodeMCU |

El divisor del MQ-9 queda asi: `MQ-9 AO → 10 kΩ → A0 del Photon → 20 kΩ → GND`. La conexion serial es **solo Photon TX a ESP D5**; no conectes `TX` del ESP al `RX` del Photon. El Photon transmite a 9600 baudios.

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
| Serial desde Photon | `D5` del NodeMCU (GPIO14) | Recibe `TX` del Photon |
| Serial sin usar | `D6` del NodeMCU | No conectar |

El divisor del MQ-2 queda asi: `MQ-2 AO → 10 kΩ → A0 del NodeMCU → 20 kΩ → GND`. El NodeMCU envia los datos por Wi-Fi y no necesita cable USB de datos permanente despues de cargar su programa.

Los modulos DHT11 de tres pines suelen incluir la resistencia pull-up. Si tienes un DHT11 desnudo de cuatro pines, conecta una resistencia de **10 kΩ entre DATA y VCC**. Revisa las etiquetas de tu modulo antes de conectar; el orden fisico de los pines no es igual en todos.

**Antes de encender:** revisa continuidad de GND comun, orientacion de cada DHT11 y los divisores. Nunca conectes la salida `AO` de un MQ directamente al pin analogico sin confirmar que no exceda el maximo admitido por tu placa.

## Instalacion y carga del programa

### 1. Preparar el servidor y la pagina

1. Instala Node.js 18 o posterior en la computadora que recibira los datos.
2. Conecta esa computadora a la misma red Wi-Fi a la que se conectara el ESP8266.
3. Abre PowerShell en la carpeta del proyecto y ejecuta:

   ```powershell
   node server.js
   ```

4. El servidor mostrara una URL local y una URL con la IP de la computadora, por ejemplo `http://192.168.1.25:3000`. Abre `http://localhost:3000` en el navegador de esa computadora.
5. Si Windows Firewall pregunta, permite el acceso **solo en redes privadas**. Reserva la IP local de la computadora en el router para que no cambie. Deja abierta la ventana de PowerShell mientras uses el panel.

El servidor no tiene autenticacion y escucha en la red local: usa una red de confianza, no configures reenvio de puertos del router y no lo expongas a Internet.

### 2. Cargar el programa del Photon

1. Instala Visual Studio Code y la extension **Particle Workbench**. Configura tu cuenta Particle y selecciona el dispositivo/firmware **Photon**.
2. Abre `photon_modulo1/photon_modulo1.ino` como proyecto de Particle Workbench.
3. Instala la libreria Particle `Adafruit_DHT` con el comando de Workbench **Particle: Install Library** si aun no esta disponible.
4. Conecta el Photon por USB, selecciona Photon como dispositivo y carga el programa con Workbench. El programa usa `D2` para el DHT11, `A0` para MQ-9 y `TX` para enviar la linea serial.
5. Abre el monitor serial a 9600 baudios para comprobar las lecturas.

Este firmware no requiere reclamar el Photon en Particle Cloud: solo usa la conexion serial hacia el ESP8266.

### 3. Cargar el programa del ESP8266

1. Instala Arduino IDE 2.x.
2. En **Preferencias → URLs adicionales de gestor de tarjetas**, agrega la URL del paquete ESP8266 de ESP8266 Community; despues, en el Gestor de tarjetas, instala **esp8266 by ESP8266 Community**.
3. En el Gestor de bibliotecas instala **DHT sensor library by Adafruit** y **Adafruit Unified Sensor**. `ESP8266WiFi`, `ESP8266HTTPClient` y `SoftwareSerial` vienen con el paquete de tarjetas ESP8266.
4. Abre `esp8266_modulo2/esp8266_modulo2.ino`. En Arduino IDE, la carpeta del sketch y el archivo `.ino` deben conservar el mismo nombre.
5. En la parte superior del archivo reemplaza:
   - `WIFI_SSID` por el nombre exacto de tu Wi-Fi.
   - `WIFI_PASSWORD` por la clave de esa red.
   - `SERVER_URL` por la IP que imprimio `node server.js`, conservando `:3000/api/readings`. Por ejemplo: `http://192.168.1.25:3000/api/readings`.
6. Selecciona la tarjeta **NodeMCU 1.0 (ESP-12E Module)** y el puerto USB correcto; compila y carga el programa.
7. Abre el Monitor serie a 115200 baudios. Debe mostrar que se conecto al Wi-Fi y respuestas `HTTP 200` al enviar lecturas.

Guarda las credenciales Wi-Fi solo en tu copia local del firmware y no publiques ese archivo con la clave.

## Comprobacion

Con el servidor ejecutandose, abre el panel y enciende ambos modulos. En unos segundos deben aparecer temperatura y humedad de cada DHT11, y una lectura relativa para cada MQ. Si el serial del ESP muestra `HTTP 200` pero el navegador no cambia, recarga `http://localhost:3000`.

Tambien puedes comprobar el servidor en PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/readings
```

La respuesta contiene `temperature1`, `humidity1`, `mq9`, `temperature2`, `humidity2`, `mq2` y `updatedAt`.

## Que significan los valores MQ

MQ-2 y MQ-9 son sensores resistivos que necesitan calentamiento, calibracion y condiciones de prueba definidas. El panel convierte el ADC de cada placa a una escala electronica **relativa de 0 a 100%**; no calcula ppm, no identifica de forma fiable un gas especifico y no indica por si solo que el aire sea seguro o peligroso. Para lecturas cuantitativas sigue la hoja de datos, el circuito de calefaccion/calibracion recomendado y patrones de gas certificados. No uses este montaje como alarma de CO ni como sustituto de un detector certificado.

## Solucion de problemas

- **El panel no abre:** confirma que `node server.js` sigue ejecutandose y que el puerto 3000 esta disponible.
- **El ESP no se conecta:** revisa SSID, clave, cobertura y que la red permita comunicacion local entre dispositivos.
- **El ESP no llega al servidor:** compara `SERVER_URL` con la IP actual impresa por Node.js; revisa Firewall en perfil privado.
- **Temperatura/humedad aparece como `--`:** revisa DATA, VCC, GND, pull-up del DHT11 y espera al siguiente ciclo de lectura.
- **No llegan datos del Photon:** confirma GND comun, `TX` del Photon a `D5` del NodeMCU, 9600 baudios y que el Monitor serie no este conectado de forma que interfiera.
- **El valor MQ se queda en 0 o cambia poco:** espera el calentamiento indicado por el fabricante y revisa alimentacion de 5 V, AO, divisor y GND. No ajustes el divisor suponiendo que el ADC aguanta mas voltaje.
