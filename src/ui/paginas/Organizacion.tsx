/**
 * Pantalla «Organización» y tira «Hoy me toca a mí» de Hoy.
 * Organización es JavaScript simple (src/organizacion/); acá solo se monta y se le pasan la base, el tema y el nombre.
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { montarOrganizacion, montarTiraHoy } from '../../organizacion'
import { almacenSek, temaSek } from '../../services/organizacion'
import { obtenerAjustes } from '../../services/base'
import { useTema } from '../../temas/temas'

export function Organizacion({ hoy }: { hoy: string }) {
  const lugar = useRef<HTMLDivElement>(null)
  const tema = useTema()
  const [params] = useSearchParams()
  const abrir = params.get('abrir') ?? undefined
  useEffect(() => {
    let montado: { desmontar(): void } | null = null
    let vivo = true
    void obtenerAjustes().then((a) => {
      if (!vivo || !lugar.current) return
      montado = montarOrganizacion(lugar.current, {
        almacen: almacenSek, tema: temaSek, nombre: a.nombrePersona || 'Yo', hoy: () => hoy,
        abajo: 'calc(var(--nav-alto) + 16px)', abrir,
      })
    })
    return () => { vivo = false; montado?.desmontar() }
  }, [hoy, tema.id, abrir])
  return <div ref={lugar} className="organizacion-pantalla" />
}

export function TiraOrganizacion({ hoy }: { hoy: string }) {
  const lugar = useRef<HTMLDivElement>(null)
  const ir = useNavigate()
  const tema = useTema()
  useEffect(() => {
    let montado: { desmontar(): void } | null = null
    let vivo = true
    void obtenerAjustes().then((a) => {
      if (!vivo || !lugar.current) return
      montado = montarTiraHoy(lugar.current, { almacen: almacenSek, tema: temaSek, nombre: a.nombrePersona || 'Yo', hoy: () => hoy, alAbrir: () => ir('/organizacion') })
    })
    return () => { vivo = false; montado?.desmontar() }
  }, [hoy, tema.id, ir])
  return <div ref={lugar} />
}
