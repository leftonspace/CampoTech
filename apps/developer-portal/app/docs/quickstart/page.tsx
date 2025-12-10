export default function QuickstartPage() {
  return (
    <div>
      <h1>Inicio rápido</h1>

      <p>
        Esta guía te ayudará a hacer tu primera llamada a la API de CampoTech en menos de 5 minutos.
      </p>

      <h2>1. Obtener tu API Key</h2>

      <p>
        Para usar la API, necesitas una API key. Puedes obtener una desde la{' '}
        <a href="/console">Consola de desarrollador</a>.
      </p>

      <ol>
        <li>Inicia sesión en la consola de desarrollador</li>
        <li>Ve a "API Keys" en el menú lateral</li>
        <li>Haz clic en "Crear API Key"</li>
        <li>Dale un nombre descriptivo y selecciona los scopes necesarios</li>
        <li>Copia y guarda tu API key de forma segura</li>
      </ol>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 my-4">
        <strong>Importante:</strong> Tu API key solo se mostrará una vez. Guárdala en un lugar seguro.
      </div>

      <h2>2. Instalar el SDK (opcional)</h2>

      <p>Recomendamos usar nuestros SDKs oficiales para una mejor experiencia de desarrollo:</p>

      <h3>TypeScript / JavaScript</h3>

      <pre><code>npm install @campotech/sdk</code></pre>

      <h3>Python</h3>

      <pre><code>pip install campotech</code></pre>

      <h2>3. Hacer tu primera llamada</h2>

      <h3>Con SDK (TypeScript)</h3>

      <pre><code>{`import { CampoTechClient } from '@campotech/sdk';

const client = new CampoTechClient({
  apiKey: 'tu_api_key_aqui'
});

// Listar clientes
const customers = await client.customers.list();
console.log(customers);`}</code></pre>

      <h3>Con SDK (Python)</h3>

      <pre><code>{`from campotech import CampoTechClient

client = CampoTechClient(api_key='tu_api_key_aqui')

# Listar clientes
customers = client.customers.list()
print(customers)`}</code></pre>

      <h3>Con cURL</h3>

      <pre><code>{`curl -X GET https://api.campotech.com/v1/customers \\
  -H "Authorization: Bearer tu_api_key_aqui" \\
  -H "Content-Type: application/json"`}</code></pre>

      <h2>4. Crear un recurso</h2>

      <p>Vamos a crear un cliente nuevo:</p>

      <h3>Con SDK (TypeScript)</h3>

      <pre><code>{`const newCustomer = await client.customers.create({
  name: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '+54 11 1234-5678',
  address: 'Av. Corrientes 1234',
  city: 'Buenos Aires',
  province: 'CABA'
});

console.log('Cliente creado:', newCustomer.id);`}</code></pre>

      <h3>Con cURL</h3>

      <pre><code>{`curl -X POST https://api.campotech.com/v1/customers \\
  -H "Authorization: Bearer tu_api_key_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+54 11 1234-5678",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "province": "CABA"
  }'`}</code></pre>

      <h2>Próximos pasos</h2>

      <ul>
        <li>Lee sobre <a href="/docs/authentication">Autenticación</a> para entender las opciones</li>
        <li>Explora la <a href="/reference">Referencia API</a> completa</li>
        <li>Configura <a href="/docs/webhooks">Webhooks</a> para recibir eventos</li>
        <li>Prueba endpoints en el <a href="/playground">Playground</a></li>
      </ul>
    </div>
  );
}
