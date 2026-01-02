export interface User {
  id_usuario?: number;   // 
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  id_rol: number;
  contrasena: string;
  nacionalidad: string;
  tipo_documento: 'Cedula' | 'DNI' | 'Pasaporte'
  numeroAlumno?: number;
  email_verificado?: boolean;
  token_verificacion?: string;
  token_verificacion_expira?: Date;
}
 
// Definición de la interfaz para representar un Rol
export interface Rol {
  id_rol: number;    
  nombre: string;     
}

// Definición de la interfaz para representar un Evento
export interface Evento {
  id_evento: number;    
  nombre: string;
  fecha: Date;
  descripcion?: string;
  cupos: number;
  cupos_suplente: number;
  fecha_limite_inscripcion: string;
  fecha_limite_baja: string;
  estado: 'vigente' | 'transcurrido' | 'cancelado'
  lugar: string;
  categoria:  'salida' |  'normal' | 'pago'

  costo?: number
  cuenta_destino?: string;
  // Campos opcionales para cuando se obtienen eventos del usuario
  es_suplente?: boolean;
  orden_suplente?: number;
}

// Definición de la interfaz para representar un Grupo
export interface Grupo {
  id_grupo : number;
  nombre: string;
  descripcion?: string;
  zona?: number;
  imagen_url?: string;
  solicitudNecesitada?: boolean;
}

export interface Subgrupo {
  id_subgrupo: number;
  id_grupo: number;
  nombre: string;
  descripcion: string;
  activo?: boolean;
}

export interface InscripcionPayload {
  eventoId: number;
  usuarioId: number;
  residencia: string;
  rol: string;
  primeraVez: boolean;
  carrera?: string;
  anioCarrera?: number;
  esSuplente?: boolean;
  subgrupo?: string
}

/* ---------- Nuevo tipos para Noticias ---------- */

/* Noticia principal */
export interface Noticia {
  id: number;
  titulo: string;
  descripcion: string;
  fecha: string;
  autor_id?: number;
  autor_nombre?: string;
  grupo_id?: number;
  grupo_nombre?: string; // Added this line to include grupo_nombre
  lugar?: string;
  imagen_path?: string;
  fijada?: boolean;
}


// Definición de la interfaz para representar una Donación
export interface Donacion {
  id_donacion?: number;
  id_usuario: number;
  monto: number;
  descripcion: string;
  fecha_donacion: Date;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  id_pago_mercadopago?: string;
  metadata?: any;
  id_grupo?: number;
}


// Definición de la interfaz para la relación Secretaria-Grupo
export interface SecretariaGrupo {
  id_secretaria_grupo?: number;
  id_usuario: number;
  id_grupo: number;
  fecha_asignacion?: Date;
}

// Interface extendida para usuario con información de grupo asignado
export interface UsuarioConGrupo extends User {
  id_grupo?: number;
  nombre_grupo?: string;
}

// Nueva interfaz para información de inscripciones con suplentes
export interface InscripcionConSuplente {
  id_inscripcion: number;
  id_usuario: number;
  id_evento: number;
  fecha_inscripcion: Date;
  es_suplente: boolean;
  orden_suplente: number | null;
  fecha_paso_a_titular: Date | null;
  residencia: string;
  rol: string;
  primera_vez: boolean;
  anio_carrera?: number;
}

// Interfaz para estadísticas de evento con suplentes
export interface EstadisticasEvento {
  cupos_totales: number;
  cupos_ocupados: number;
  cupos_disponibles: number;
  cupos_suplente_totales: number;
  suplentes_inscritos: number;
  suplentes_disponibles: number;
}


export interface Donantes {
  id_donante_fijo: number,
  id_grupo: number,
  nombre: string,
  apellido: string,
  email: string,
  dni: number
}

export interface Subevento  {
  id_evento?: number, 
  id_subgrupo: number, 
  cupos: number, 
  cupos_suplente: number
}
