# Pedido Rapido IPEF

Prototipo web para la cantina IPEF:

- listado de productos del kiosko
- carrito de compra
- seleccion de metodo de pago
- generacion de QR del pedido
- vista para empleado al abrir la comanda

## Uso local

1. Ejecuta `node server.js`.
2. Abri `http://localhost:8080`.
3. Cliente: arma el pedido y genera el QR.
4. Empleado: abre `http://localhost:8080/empleado.html`.

## Deploy en Vercel

El proyecto ya queda preparado para Vercel con:

- archivos estaticos en la raiz
- funciones serverless en `api/orders`
- ruta amigable `https://tu-dominio/empleado`

Pasos:

1. Sube esta carpeta a GitHub.
2. Importa el repo en Vercel.
3. Deploy normal, sin build command especial.

## Importante sobre historial

En local, los pedidos se guardan en `orders-history.json`.

En Vercel, sin base de datos externa, el guardado es temporal porque las funciones serverless no persisten archivos como un servidor normal. Si queres historial permanente de pedidos finalizados, el siguiente paso recomendable es conectar Vercel KV, Postgres o Supabase.

## Nota

El QR se genera con `quickchart.io`, asi que para ver la imagen del QR hace falta conexion a internet.
