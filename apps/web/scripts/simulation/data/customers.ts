/**
 * Customer Data
 * ==============
 * 
 * Raw customer data for simulation - Buenos Aires region.
 * Mix of residential and commercial clients.
 */

export interface CustomerTemplate {
    name: string;
    phone: string;
    email: string | null;
    address: {
        street: string;
        floor: string | null;
        apartment: string | null;
        city: string;
        province: string;
        neighborhood: string;
        postalCode: string;
        // Use coordinates object format for map compatibility
        coordinates: { lat: number; lng: number };
    };
    propertyType: string;
    businessType?: string;
    notes: string | null;
    isVip: boolean;
}

/**
 * 100 Customers for medium company (Buenos Aires region)
 */
export const CUSTOMERS: CustomerTemplate[] = [
    // ═══════════════════════════════════════════════════════════════════════════════
    // RESIDENTIAL - CABA
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        name: 'María González',
        phone: '+541133334444',
        email: 'maria.gonzalez@gmail.com',
        address: {
            street: 'Av. Santa Fe 2345',
            floor: '5',
            apartment: 'A',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Palermo',
            postalCode: '1425',
            coordinates: { lat: -34.5875, lng: -58.4089 },
        },
        propertyType: 'Departamento',
        notes: 'Edificio antiguo, timbre no funciona. Llamar al llegar.',
        isVip: false,
    },
    {
        name: 'Carlos Rodríguez',
        phone: '+541155556666',
        email: 'carlos.rodriguez@hotmail.com',
        address: {
            street: 'Av. Cabildo 2890',
            floor: '8',
            apartment: 'C',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Belgrano',
            postalCode: '1428',
            coordinates: { lat: -34.5612, lng: -58.4534 },
        },
        propertyType: 'Departamento',
        notes: 'Cliente frecuente. Siempre ofrece café.',
        isVip: true,
    },
    {
        name: 'Laura Martínez',
        phone: '+541166667777',
        email: 'laura.martinez@outlook.com',
        address: {
            street: 'Av. Corrientes 4567',
            floor: '3',
            apartment: 'B',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Almagro',
            postalCode: '1194',
            coordinates: { lat: -34.6045, lng: -58.4234 },
        },
        propertyType: 'Departamento',
        notes: null,
        isVip: false,
    },
    {
        name: 'Roberto Fernández',
        phone: '+541177778888',
        email: 'roberto.fernandez@yahoo.com',
        address: {
            street: 'Av. Rivadavia 5678',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Caballito',
            postalCode: '1406',
            coordinates: { lat: -34.6178, lng: -58.4423 },
        },
        propertyType: 'PH',
        notes: 'Solo disponible después de las 18hs.',
        isVip: false,
    },
    {
        name: 'Silvia Ramírez',
        phone: '+541111112222',
        email: 'silvia.ramirez@outlook.com',
        address: {
            street: 'Av. Díaz Vélez 4890',
            floor: '6',
            apartment: 'B',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Caballito',
            postalCode: '1200',
            coordinates: { lat: -34.6112, lng: -58.4356 },
        },
        propertyType: 'Departamento',
        notes: null,
        isVip: false,
    },
    {
        name: 'Jorge Pérez',
        phone: '+541188889999',
        email: null,
        address: {
            street: 'Av. Scalabrini Ortiz 1234',
            floor: '2',
            apartment: 'D',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Villa Crespo',
            postalCode: '1414',
            coordinates: { lat: -34.5923, lng: -58.4267 },
        },
        propertyType: 'Departamento',
        notes: 'Prefiere WhatsApp, no llamar.',
        isVip: false,
    },
    {
        name: 'Ana López',
        phone: '+541199990000',
        email: 'ana.lopez@gmail.com',
        address: {
            street: 'Gurruchaga 567',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Villa Crespo',
            postalCode: '1414',
            coordinates: { lat: -34.5956, lng: -58.4345 },
        },
        propertyType: 'Casa',
        notes: 'Casa con jardín. Estacionar en la calle.',
        isVip: false,
    },
    {
        name: 'Fernando González',
        phone: '+541122223333',
        email: 'fernando.gonzalez@gmail.com',
        address: {
            street: 'Av. Del Libertador 14500',
            floor: null,
            apartment: null,
            city: 'Martinez',
            province: 'Buenos Aires',
            neighborhood: 'Zona Norte',
            postalCode: '1640',
            coordinates: { lat: -34.4912, lng: -58.5012 },
        },
        propertyType: 'Casa',
        notes: 'Casa grande con pileta. Acceso por cochera.',
        isVip: true,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // COMMERCIAL - RESTAURANTS/GASTRONOMY
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        name: 'Restaurante Don Julio',
        phone: '+541144445555',
        email: 'gerencia@donjulio.com.ar',
        address: {
            street: 'Guatemala 4699',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Palermo Soho',
            postalCode: '1425',
            coordinates: { lat: -34.5834, lng: -58.4278 },
        },
        propertyType: 'Local Comercial',
        businessType: 'Gastronomía',
        notes: 'Restaurante grande. Atender fuera de horario de almuerzo (14-17hs ideal).',
        isVip: true,
    },
    {
        name: 'Café Martínez - Sucursal Centro',
        phone: '+541155554433',
        email: 'sucursal.centro@cafemartinez.com.ar',
        address: {
            street: 'Av. Corrientes 1234',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Microcentro',
            postalCode: '1043',
            coordinates: { lat: -34.6037, lng: -58.3816 },
        },
        propertyType: 'Local Comercial',
        businessType: 'Gastronomía',
        notes: 'Heladeras y máquinas de café. Emergencias 24hs.',
        isVip: true,
    },
    {
        name: 'Pizzería Guerrín',
        phone: '+541166665544',
        email: 'mantenimiento@guerrin.com.ar',
        address: {
            street: 'Av. Corrientes 1368',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Centro',
            postalCode: '1043',
            coordinates: { lat: -34.6041, lng: -58.3845 },
        },
        propertyType: 'Local Comercial',
        businessType: 'Gastronomía',
        notes: 'Hornos y cámaras frigoríficas. Horario preferido: 8-11am.',
        isVip: false,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // COMMERCIAL - OFFICES
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        name: 'Oficinas Tech Solutions',
        phone: '+541188887766',
        email: 'facilities@techsolutions.com.ar',
        address: {
            street: 'Av. Madero 1200',
            floor: '15',
            apartment: 'Piso completo',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Puerto Madero',
            postalCode: '1106',
            coordinates: { lat: -34.6112, lng: -58.3634 },
        },
        propertyType: 'Oficina',
        businessType: 'Tecnología',
        notes: 'Oficinas con 50+ equipos de aire. Mantenimiento semestral.',
        isVip: true,
    },
    {
        name: 'Estudio Jurídico Pérez & Asociados',
        phone: '+541177776655',
        email: 'admin@perezasociados.com.ar',
        address: {
            street: 'Av. Córdoba 456',
            floor: '10',
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Microcentro',
            postalCode: '1054',
            coordinates: { lat: -34.5989, lng: -58.3756 },
        },
        propertyType: 'Oficina',
        businessType: 'Servicios Profesionales',
        notes: null,
        isVip: false,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // COMMERCIAL - RETAIL
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        name: 'Supermercado Día - Sucursal 45',
        phone: '+541199998877',
        email: 'sucursal45@dia.com.ar',
        address: {
            street: 'Av. Corrientes 3456',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Once',
            postalCode: '1195',
            coordinates: { lat: -34.6067, lng: -58.4012 },
        },
        propertyType: 'Local Comercial',
        businessType: 'Supermercado',
        notes: 'Cámaras frigoríficas. Emergencias 24hs. Llamar a supervisor.',
        isVip: true,
    },
    {
        name: 'Farmacia del Pueblo',
        phone: '+541111110000',
        email: 'farmacia.pueblo@gmail.com',
        address: {
            street: 'Av. Rivadavia 7890',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Flores',
            postalCode: '1406',
            coordinates: { lat: -34.6289, lng: -58.4623 },
        },
        propertyType: 'Local Comercial',
        businessType: 'Farmacia',
        notes: 'Heladera de medicamentos. Urgencias.',
        isVip: false,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // COMMERCIAL - HOSPITALITY
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        name: 'Hotel Boutique Palermo',
        phone: '+541144443322',
        email: 'mantenimiento@hotelboutiquepalermo.com',
        address: {
            street: 'Honduras 5678',
            floor: null,
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Palermo Hollywood',
            postalCode: '1414',
            coordinates: { lat: -34.5812, lng: -58.4345 },
        },
        propertyType: 'Hotel',
        businessType: 'Hotelería',
        notes: 'Hotel 4 estrellas. 45 habitaciones con aire. Coordinar por recepción.',
        isVip: true,
    },
    {
        name: 'Gimnasio PowerFit',
        phone: '+541100009988',
        email: 'info@powerfit.com.ar',
        address: {
            street: 'Av. Scalabrini Ortiz 2890',
            floor: 'PB y Subsuelo',
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Palermo',
            postalCode: '1425',
            coordinates: { lat: -34.5756, lng: -58.4234 },
        },
        propertyType: 'Local Comercial',
        businessType: 'Gimnasio',
        notes: 'Sistema de ventilación grande. Mantenimiento mensual.',
        isVip: false,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSORCIOS (Building Consortiums)
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        name: 'Consorcio Edificio Las Flores',
        phone: '+541155551234',
        email: 'administracion@edificiolasflores.com',
        address: {
            street: 'Av. Santa Fe 3200',
            floor: 'PB',
            apartment: 'Administración',
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Palermo',
            postalCode: '1425',
            coordinates: { lat: -34.5823, lng: -58.4156 },
        },
        propertyType: 'Edificio',
        notes: 'Edificio 20 pisos. Mantenimiento de calderas y tanques.',
        isVip: true,
    },
    {
        name: 'Consorcio Torres del Sol',
        phone: '+541166664321',
        email: 'admin@torressol.com.ar',
        address: {
            street: 'Av. Libertador 5000',
            floor: 'PB',
            apartment: null,
            city: 'CABA',
            province: 'Buenos Aires',
            neighborhood: 'Núñez',
            postalCode: '1429',
            coordinates: { lat: -34.5456, lng: -58.4512 },
        },
        propertyType: 'Edificio',
        notes: 'Complejo 3 torres. Contactar encargado.',
        isVip: true,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // MORE RESIDENTIAL (to fill 100 customers)
    // ═══════════════════════════════════════════════════════════════════════════════
    { name: 'Diego Moreno', phone: '+541155550001', email: null, address: { street: 'Av. Mitre 734', floor: '2', apartment: 'C', city: 'Avellaneda', province: 'Buenos Aires', neighborhood: 'Centro', postalCode: '1870', coordinates: { lat: -34.6623, lng: -58.3651 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Patricia Sosa', phone: '+541155550002', email: 'patricia.sosa@gmail.com', address: { street: 'San Martín 456', floor: null, apartment: null, city: 'Quilmes', province: 'Buenos Aires', neighborhood: 'Centro', postalCode: '1878', coordinates: { lat: -34.7204, lng: -58.2524 } }, propertyType: 'Casa', notes: null, isVip: false },
    { name: 'Andrés Gómez', phone: '+541155550003', email: null, address: { street: 'Av. Hipólito Yrigoyen 2345', floor: '4', apartment: 'A', city: 'Lomas de Zamora', province: 'Buenos Aires', neighborhood: 'Centro', postalCode: '1832', coordinates: { lat: -34.7612, lng: -58.4012 } }, propertyType: 'Departamento', notes: 'Timbre 4A', isVip: false },
    { name: 'Luciana Paz', phone: '+541155550004', email: 'luciana.paz@hotmail.com', address: { street: 'Av. Maipú 890', floor: '7', apartment: 'B', city: 'Vicente López', province: 'Buenos Aires', neighborhood: 'Zona Norte', postalCode: '1638', coordinates: { lat: -34.5234, lng: -58.4712 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Martín Aquino', phone: '+541155550005', email: null, address: { street: 'Av. Centenario 1234', floor: null, apartment: null, city: 'San Isidro', province: 'Buenos Aires', neighborhood: 'Zona Norte', postalCode: '1642', coordinates: { lat: -34.4712, lng: -58.5234 } }, propertyType: 'Casa', notes: 'Casa con rejas, tocar timbre amarillo', isVip: false },
    { name: 'Valeria Díaz', phone: '+541155550006', email: 'valeria.diaz@gmail.com', address: { street: 'Thames 1567', floor: '3', apartment: 'D', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Palermo', postalCode: '1414', coordinates: { lat: -34.5912, lng: -58.4267 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Sebastián Romero', phone: '+541155550007', email: null, address: { street: 'Av. Córdoba 5678', floor: '10', apartment: 'E', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Palermo', postalCode: '1414', coordinates: { lat: -34.5987, lng: -58.4312 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Florencia Navarro', phone: '+541155550008', email: 'florencia.n@outlook.com', address: { street: 'Av. Callao 234', floor: '5', apartment: 'A', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Recoleta', postalCode: '1022', coordinates: { lat: -34.6012, lng: -58.3923 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Nicolás Vargas', phone: '+541155550009', email: null, address: { street: 'Av. Las Heras 3456', floor: '8', apartment: 'C', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Recoleta', postalCode: '1425', coordinates: { lat: -34.5867, lng: -58.4023 } }, propertyType: 'Departamento', notes: 'Solo por la mañana', isVip: false },
    { name: 'Camila Medina', phone: '+541155550010', email: 'camila.medina@gmail.com', address: { street: 'Av. Monroe 1234', floor: '3', apartment: 'B', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Belgrano', postalCode: '1428', coordinates: { lat: -34.5612, lng: -58.4534 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Tomás Acosta', phone: '+541155550011', email: null, address: { street: 'Arcos 2890', floor: null, apartment: null, city: 'CABA', province: 'Buenos Aires', neighborhood: 'Belgrano', postalCode: '1428', coordinates: { lat: -34.5589, lng: -58.4612 } }, propertyType: 'PH', notes: 'PH al fondo', isVip: false },
    { name: 'Carolina Ruiz', phone: '+541155550012', email: 'carolina.ruiz@yahoo.com', address: { street: 'Av. García del Río 3456', floor: '2', apartment: 'A', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Saavedra', postalCode: '1430', coordinates: { lat: -34.5523, lng: -58.4823 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Alejandro Moreno', phone: '+541155550013', email: null, address: { street: 'Av. Triunvirato 5678', floor: '6', apartment: 'D', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Villa Urquiza', postalCode: '1431', coordinates: { lat: -34.5734, lng: -58.4912 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Daniela Castro', phone: '+541155550014', email: 'daniela.castro@gmail.com', address: { street: 'Av. San Martín 4567', floor: '4', apartment: 'C', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Villa del Parque', postalCode: '1417', coordinates: { lat: -34.6089, lng: -58.4834 } }, propertyType: 'Departamento', notes: null, isVip: false },
    { name: 'Pablo Giménez', phone: '+541155550015', email: null, address: { street: 'Av. Nazca 789', floor: null, apartment: null, city: 'CABA', province: 'Buenos Aires', neighborhood: 'Villa del Parque', postalCode: '1417', coordinates: { lat: -34.6112, lng: -58.4912 } }, propertyType: 'Casa', notes: 'Garage por la izquierda', isVip: false },
];

// Generate more customers dynamically to reach 100
export function generateAdditionalCustomers(count: number): CustomerTemplate[] {
    const names = ['García', 'López', 'Martínez', 'Rodríguez', 'Fernández', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres'];
    const firstNames = ['Juan', 'María', 'Carlos', 'Laura', 'Roberto', 'Sandra', 'Miguel', 'Claudia', 'Daniel', 'Andrea'];
    const neighborhoods = ['Palermo', 'Belgrano', 'Recoleta', 'Caballito', 'Flores', 'Villa Crespo', 'Almagro', 'Boedo'];
    const streets = ['Av. Santa Fe', 'Av. Corrientes', 'Av. Córdoba', 'Av. Cabildo', 'Av. Rivadavia', 'Av. Las Heras'];

    const additional: CustomerTemplate[] = [];
    for (let i = 0; i < count; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = names[Math.floor(Math.random() * names.length)];
        const neighborhood = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
        const street = streets[Math.floor(Math.random() * streets.length)];

        additional.push({
            name: `${firstName} ${lastName}`,
            phone: `+54115555${String(100 + i).padStart(4, '0')}`,
            email: Math.random() > 0.3 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com` : null,
            address: {
                street: `${street} ${1000 + Math.floor(Math.random() * 5000)}`,
                floor: Math.random() > 0.4 ? String(Math.floor(Math.random() * 15) + 1) : null,
                apartment: Math.random() > 0.4 ? String.fromCharCode(65 + Math.floor(Math.random() * 6)) : null,
                city: 'CABA',
                province: 'Buenos Aires',
                neighborhood,
                postalCode: `14${Math.floor(Math.random() * 50)}`,
                // Keep coordinates within Buenos Aires land (west of -58.36 to avoid ocean)
                coordinates: {
                    lat: -34.58 + (Math.random() * 0.08 - 0.04),   // -34.62 to -34.54
                    lng: -58.48 + (Math.random() * 0.08 - 0.02),  // -58.50 to -58.42 (stays west)
                },
            },
            propertyType: Math.random() > 0.7 ? 'Casa' : 'Departamento',
            notes: null,
            isVip: false,
        });
    }
    return additional;
}

