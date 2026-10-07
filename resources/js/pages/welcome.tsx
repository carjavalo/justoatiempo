import { Contacto } from '@/components/landing/contacto';
import { Encabezado } from '@/components/landing/encabezado';
import { Nosotros } from '@/components/landing/nosotros';
import { Pie } from '@/components/landing/pie';
import { Portada } from '@/components/landing/portada';
import { PorQueElegirnos, SeguridadCobertura, Sectores } from '@/components/landing/secciones';
import { Servicios } from '@/components/landing/servicios';
import { EMPRESA } from '@/lib/portafolio';
import { Head } from '@inertiajs/react';

/** Página principal: presentación de la empresa a partir de su portafolio de servicios. */
export default function Welcome({ servicios }: { servicios: string[] }) {
    return (
        <>
            <Head title="Servicios operativos, logísticos y de aseo">
                <meta
                    name="description"
                    content="Justo a Tiempo SP S.A.S: suministro de personal operativo, servicios logísticos, aseo general e industrial, aseo de construcción, zonas verdes y apoyo a plantas. Cobertura nacional."
                />
                <meta property="og:title" content={`${EMPRESA.nombre} · Soluciones operativas integrales`} />
                <meta property="og:description" content={EMPRESA.lema} />
                <meta property="og:type" content="website" />
                <meta property="og:image" content="/images/marca/hero-servicios.jpg" />
            </Head>

            <a
                href="#contenido"
                className="bg-card text-foreground sr-only z-50 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2 focus-visible:ring-ring"
            >
                Saltar al contenido
            </a>

            <div className="bg-background text-foreground">
                <Encabezado />
                <main id="contenido" tabIndex={-1} className="outline-none">
                    <Portada />
                    <Nosotros />
                    <Servicios />
                    <PorQueElegirnos />
                    <Sectores />
                    <SeguridadCobertura />
                    <Contacto servicios={servicios} />
                </main>
                <Pie />
            </div>
        </>
    );
}
