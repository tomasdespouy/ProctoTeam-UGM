"""
ProctoTeam UGM - Technical & Security Report Generator
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib import colors
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'ProctoTeam_UGM_Informe_Tecnico.pdf')

NAVY = HexColor('#1A1D47')
CYAN = HexColor('#00D4FF')
RED = HexColor('#EF4444')
ORANGE = HexColor('#F97316')
YELLOW = HexColor('#EAB308')
GREEN = HexColor('#22C55E')
GRAY = HexColor('#64748B')
LIGHT_BG = HexColor('#F1F5F9')
WHITE = white

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=28, textColor=NAVY, spaceAfter=6, alignment=TA_CENTER,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'CoverSub', parent=styles['Normal'],
    fontSize=14, textColor=GRAY, alignment=TA_CENTER, spaceAfter=4
))
styles.add(ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontSize=18, textColor=NAVY, spaceBefore=24, spaceAfter=10,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontSize=14, textColor=NAVY, spaceBefore=16, spaceAfter=8,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontSize=11, textColor=HexColor('#334155'), spaceBefore=10, spaceAfter=6,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#1E293B'),
    alignment=TA_JUSTIFY, spaceAfter=6
))
styles.add(ParagraphStyle(
    'BulletItem', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#1E293B'),
    leftIndent=20, spaceAfter=3, bulletIndent=8
))
styles.add(ParagraphStyle(
    'CodeBlock', parent=styles['Normal'],
    fontSize=8, fontName='Courier', textColor=HexColor('#1E293B'),
    backColor=LIGHT_BG, leftIndent=12, rightIndent=12,
    spaceBefore=4, spaceAfter=4, leading=11
))
styles.add(ParagraphStyle(
    'Footer', parent=styles['Normal'],
    fontSize=8, textColor=GRAY, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'TableCell', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=HexColor('#1E293B')
))
styles.add(ParagraphStyle(
    'TableHeader', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=WHITE, fontName='Helvetica-Bold'
))

def make_table(headers, rows, col_widths=None):
    header_cells = [Paragraph(h, styles['TableHeader']) for h in headers]
    data = [header_cells]
    for row in rows:
        data.append([Paragraph(str(c), styles['TableCell']) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]))
    return t

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor('#CBD5E1'), spaceBefore=6, spaceAfter=6)

def build_report():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=letter,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="ProctoTeam UGM - Informe Tecnico y de Seguridad",
        author="Claude Code + Equipo ProctoTeam"
    )
    story = []
    W = doc.width

    # ── COVER ──
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("ProctoTeam UGM", styles['CoverTitle']))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Informe Tecnico y de Seguridad", styles['CoverSub']))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Sistema de Vigilancia de Examenes en Linea", styles['CoverSub']))
    story.append(Spacer(1, 30))
    story.append(hr())
    story.append(Spacer(1, 10))

    cover_info = [
        ["Organizacion", "Universidad Gabriela Mistral (IDEA UGM)"],
        ["Proyecto", "ProctoTeam - Proctoring en linea"],
        ["Version", "2.1 (Abril 2026)"],
        ["Clasificacion", "Confidencial - Uso Interno"],
        ["Fecha", "10 de Abril de 2026"],
        ["Preparado por", "Equipo ProctoTeam + Claude Code"],
    ]
    cover_table = Table(cover_info, colWidths=[1.8*inch, 4*inch])
    cover_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), NAVY),
        ('TEXTCOLOR', (1, 0), (1, -1), HexColor('#334155')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    story.append(cover_table)
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ──
    story.append(Paragraph("Indice", styles['H1']))
    toc_items = [
        "1. Resumen Ejecutivo",
        "2. Arquitectura del Sistema",
        "3. Sistema de Autenticacion",
        "4. Base de Datos",
        "5. Sistema de Proctoring e IA",
        "6. Comunicacion en Tiempo Real",
        "7. Endpoints API",
        "8. Analisis de Seguridad",
        "9. Hallazgos y Vulnerabilidades",
        "10. Recomendaciones",
        "11. Roadmap de Mejoras",
    ]
    for item in toc_items:
        story.append(Paragraph(item, styles['Body']))
    story.append(PageBreak())

    # ── 1. RESUMEN EJECUTIVO ──
    story.append(Paragraph("1. Resumen Ejecutivo", styles['H1']))
    story.append(Paragraph(
        "ProctoTeam UGM es un sistema de vigilancia de examenes en linea desarrollado para la "
        "Universidad Gabriela Mistral. Permite a los docentes supervisar a los estudiantes durante "
        "evaluaciones remotas mediante camaras web, deteccion de rostros por IA, identificacion de "
        "objetos prohibidos y captura de evidencia automatica.",
        styles['Body']
    ))
    story.append(Paragraph(
        "El sistema utiliza una arquitectura full-stack basada en Next.js 15, PostgreSQL (Supabase), "
        "Azure AD para autenticacion institucional, WebRTC para video en tiempo real, y modelos de "
        "Machine Learning (MediaPipe + COCO-SSD) para deteccion automatica de infracciones.",
        styles['Body']
    ))
    story.append(Paragraph(
        "Este informe documenta la arquitectura tecnica, los mecanismos de seguridad implementados, "
        "las vulnerabilidades identificadas y las recomendaciones para mejoras futuras.",
        styles['Body']
    ))

    story.append(Paragraph("Metricas Clave", styles['H3']))
    metrics = [
        ["Metrica", "Valor"],
        ["Rutas API", "20+ endpoints"],
        ["Tablas de BD", "6 tablas relacionales"],
        ["Modelos de IA", "2 (Face Mesh + COCO-SSD)"],
        ["Frecuencia deteccion", "Cada 500ms"],
        ["Tipos de alerta", "4 (rostro ausente, multiples rostros, mirada desviada, objeto prohibido)"],
        ["Roles de usuario", "3 (estudiante, instructor, super-admin)"],
    ]
    story.append(make_table(metrics[0], metrics[1:], col_widths=[2.5*inch, 4.2*inch]))
    story.append(PageBreak())

    # ── 2. ARQUITECTURA ──
    story.append(Paragraph("2. Arquitectura del Sistema", styles['H1']))

    story.append(Paragraph("2.1 Stack Tecnologico", styles['H2']))
    stack = [
        ["Capa", "Tecnologia", "Version"],
        ["Framework", "Next.js (App Router)", "15.3.9"],
        ["Frontend", "React + TypeScript", "18.3.1 / TS 5"],
        ["Estilos", "Tailwind CSS + Radix UI", "3.4.1"],
        ["Base de Datos", "PostgreSQL (Supabase)", "15+"],
        ["Autenticacion", "Azure AD (MSAL) + JWT", "RS256 / HS256"],
        ["IA - Rostros", "MediaPipe Face Mesh", "0.4.x"],
        ["IA - Objetos", "COCO-SSD (TensorFlow.js)", "2.2.3"],
        ["IA - LLM", "Google Gemini (Genkit)", "1.8.0"],
        ["Video", "WebRTC (nativo)", "Peer-to-peer"],
        ["Almacenamiento", "Supabase Storage (S3)", "-"],
        ["Deploy", "Vercel", "Serverless"],
    ]
    story.append(make_table(stack[0], stack[1:], col_widths=[1.5*inch, 3.2*inch, 2*inch]))

    story.append(Paragraph("2.2 Diagrama de Flujo", styles['H2']))
    story.append(Paragraph(
        "El flujo principal del sistema opera en tres capas:",
        styles['Body']
    ))
    flow_items = [
        "<b>Capa Cliente</b>: React SPA con WebRTC (camara + pantalla), deteccion de IA local "
        "(Face Mesh + COCO-SSD ejecutandose en el navegador del estudiante).",
        "<b>Capa API</b>: Next.js API Routes (serverless en Vercel) que manejan autenticacion, "
        "CRUD de examenes, alertas, evidencia y comunicacion en tiempo real.",
        "<b>Capa Datos</b>: PostgreSQL en Supabase para persistencia, Supabase Storage para "
        "imagenes de evidencia, Supabase Realtime para senalizacion WebRTC.",
    ]
    for item in flow_items:
        story.append(Paragraph(item, styles['BulletItem'], bulletText='\u2022'))

    story.append(Paragraph("2.3 Conectividad de Base de Datos", styles['H2']))
    story.append(Paragraph(
        "El sistema implementa un mecanismo de doble conexion: intenta conectar directamente a "
        "PostgreSQL (IPv6), y si falla (redes sin soporte IPv6), utiliza automaticamente un "
        "fallback via API REST de Supabase (IPv4). Esto se logra mediante una funcion RPC "
        "personalizada (exec_sql) que permite ejecutar consultas SQL parametrizadas a traves "
        "del endpoint HTTP de Supabase.",
        styles['Body']
    ))
    story.append(PageBreak())

    # ── 3. AUTENTICACION ──
    story.append(Paragraph("3. Sistema de Autenticacion", styles['H1']))

    story.append(Paragraph("3.1 Azure AD (Produccion)", styles['H2']))
    story.append(Paragraph(
        "La autenticacion principal utiliza Microsoft Azure Active Directory con el protocolo "
        "OpenID Connect. Los tokens JWT son firmados con RS256 (criptografia asimetrica) y "
        "verificados contra el endpoint JWKS de Azure.",
        styles['Body']
    ))
    auth_flow = [
        "1. El usuario hace clic en 'Ingresar con Microsoft'.",
        "2. MSAL abre un popup hacia Azure AD para autenticacion.",
        "3. Azure retorna un ID Token (JWT) con el claim 'oid' como identificador.",
        "4. El frontend almacena el token en sessionStorage.",
        "5. Cada request API incluye el header Authorization: Bearer {token}.",
        "6. El backend verifica la firma contra Azure JWKS (RS256).",
        "7. Se busca el usuario en PostgreSQL por UID y se retorna su perfil con rol.",
    ]
    for step in auth_flow:
        story.append(Paragraph(step, styles['BulletItem'], bulletText='\u2022'))

    story.append(Paragraph("3.2 Tokens de Desarrollo/Test", styles['H2']))
    story.append(Paragraph(
        "Para pruebas, el sistema ofrece un endpoint /api/auth/dev-login que genera tokens "
        "JWT firmados con HS256 y un secreto simetrico. Este endpoint se habilita mediante "
        "la variable de entorno ALLOW_TEST_LOGIN=true. Los tokens de desarrollo incluyen un "
        "claim 'dev: true' para identificarlos en logs.",
        styles['Body']
    ))

    story.append(Paragraph("3.3 Control de Acceso por Roles", styles['H2']))
    roles = [
        ["Rol", "Permisos"],
        ["student", "Unirse a examenes, enviar snapshots, recibir mensajes"],
        ["instructor", "Crear examenes, monitorear estudiantes, generar alertas, bloquear"],
        ["super-admin", "Gestionar usuarios, promover roles, ver todos los examenes y alertas"],
    ]
    story.append(make_table(roles[0], roles[1:], col_widths=[1.5*inch, 5.2*inch]))
    story.append(PageBreak())

    # ── 4. BASE DE DATOS ──
    story.append(Paragraph("4. Base de Datos", styles['H1']))
    story.append(Paragraph(
        "El esquema PostgreSQL consta de 6 tablas principales con relaciones via foreign keys "
        "y politicas de CASCADE DELETE para integridad referencial.",
        styles['Body']
    ))

    tables_info = [
        ["Tabla", "Proposito", "Registros clave"],
        ["users", "Usuarios autenticados (Azure AD/dev)", "uid, email, nombre, role"],
        ["exam_sessions", "Configuracion de examenes", "title, access_code, instructor_id, status"],
        ["exam_participations", "Estudiantes en cada examen", "student_id, status, last_snapshot"],
        ["alerts", "Incidencias de proctoring", "severity, description, evidence_url"],
        ["exam_alerts", "Alertas extendidas con review", "alert_type, reviewed, reviewed_by"],
        ["messages", "Chat instructor-estudiante", "message, is_read"],
    ]
    story.append(make_table(tables_info[0], tables_info[1:], col_widths=[1.5*inch, 2.5*inch, 2.7*inch]))

    story.append(Paragraph("4.1 Relaciones", styles['H2']))
    story.append(Paragraph(
        "users (1) --> (N) exam_sessions (via instructor_id)<br/>"
        "exam_sessions (1) --> (N) exam_participations (via exam_session_id)<br/>"
        "users (1) --> (N) exam_participations (via student_id)<br/>"
        "exam_sessions (1) --> (N) alerts (via exam_session_id)<br/>"
        "users (1) --> (N) alerts (via student_id)<br/>"
        "exam_sessions (1) --> (N) messages (via exam_session_id)",
        styles['Code']
    ))
    story.append(PageBreak())

    # ── 5. SISTEMA DE PROCTORING ──
    story.append(Paragraph("5. Sistema de Proctoring e Inteligencia Artificial", styles['H1']))

    story.append(Paragraph("5.1 Ciclo de Deteccion", styles['H2']))
    story.append(Paragraph(
        "El sistema ejecuta un ciclo de deteccion cada 500ms en el navegador del estudiante. "
        "Este ciclo coordina dos modelos de ML que analizan el video de la camara web:",
        styles['Body']
    ))
    detection_items = [
        "<b>MediaPipe Face Mesh</b>: Detecta hasta 3 rostros con landmarks 3D. "
        "Calcula yaw (giro lateral), pitch (inclinacion) y roll (rotacion) para "
        "determinar si el estudiante esta mirando hacia otro lado.",
        "<b>COCO-SSD</b>: Modelo de deteccion de objetos basado en MobileNet v2. "
        "Identifica telefonos celulares con un umbral minimo de 45% de confianza.",
    ]
    for item in detection_items:
        story.append(Paragraph(item, styles['BulletItem'], bulletText='\u2022'))

    story.append(Paragraph("5.2 Tipos de Alerta", styles['H2']))
    alert_types = [
        ["Tipo", "Severidad", "Condicion", "Cooldown"],
        ["multiple_faces", "CRITICAL", "Mas de 1 rostro detectado", "10 seg"],
        ["no_face", "HIGH", "0 rostros por 2+ segundos", "Una vez por ausencia"],
        ["looking_away", "MEDIUM", "Yaw > 30 grados o Pitch > 25 grados por 2+ seg", "Una vez por desviacion"],
        ["prohibited_object", "CRITICAL", "Telefono detectado (> 45% confianza)", "10 seg por objeto"],
        ["tab_switch", "HIGH", "Estudiante cambio de pestana del navegador", "Inmediato"],
        ["window_blur", "MEDIUM", "Estudiante salio de la ventana del navegador", "Inmediato"],
    ]
    story.append(make_table(alert_types[0], alert_types[1:], col_widths=[1.3*inch, 1*inch, 2.8*inch, 1.6*inch]))

    story.append(Paragraph("5.3 Captura de Evidencia", styles['H2']))
    story.append(Paragraph(
        "Para alertas de severidad HIGH o CRITICAL, el sistema captura un frame compuesto "
        "(640x360 JPEG al 50% de calidad) que combina la pantalla compartida del estudiante "
        "con un recuadro picture-in-picture de su camara web (160x120 px, borde rojo). "
        "La imagen se sube a Supabase Storage y la URL publica se adjunta al registro de alerta.",
        styles['Body']
    ))

    story.append(Paragraph("5.4 Evaluacion por LLM (Gemini)", styles['H2']))
    story.append(Paragraph(
        "El sistema integra Google Gemini 1.5 Flash (via Genkit) para evaluar contextualmente "
        "las alertas generadas. El modelo recibe el tipo de evento, detalles del estudiante y "
        "nombre del examen, y retorna: severidad sugerida, explicacion, recomendacion y un "
        "score de confianza (0-1). Esto permite al instructor comprender el contexto de cada alerta.",
        styles['Body']
    ))
    story.append(PageBreak())

    # ── 6. COMUNICACION TIEMPO REAL ──
    story.append(Paragraph("6. Comunicacion en Tiempo Real", styles['H1']))

    story.append(Paragraph("6.1 WebRTC", styles['H2']))
    story.append(Paragraph(
        "La transmision de video utiliza WebRTC nativo del navegador para comunicacion "
        "peer-to-peer entre el estudiante y el instructor. El estudiante envia dos streams: "
        "camara web y pantalla compartida. El instructor recibe ambos en modo solo lectura.",
        styles['Body']
    ))

    story.append(Paragraph("6.2 Senalizacion", styles['H2']))
    story.append(Paragraph(
        "El intercambio de ofertas/respuestas SDP se realiza a traves de Supabase Realtime "
        "(basado en PostgreSQL LISTEN/NOTIFY). Los mensajes de senalizacion incluyen tipo "
        "(offer/answer), IDs de origen/destino y datos SDP.",
        styles['Body']
    ))

    story.append(Paragraph("6.3 Servidores ICE", styles['H2']))
    story.append(Paragraph(
        "Se utilizan servidores STUN publicos de Google (stun.l.google.com:19302). "
        "No hay servidores TURN configurados, lo que significa que estudiantes detras de "
        "NAT simetrico podrian no lograr conexion directa.",
        styles['Body']
    ))

    story.append(Paragraph("6.4 Polling del Dashboard", styles['H2']))
    story.append(Paragraph(
        "El dashboard del instructor consulta GET /api/live?examId=X cada 5 segundos "
        "para obtener el estado actualizado de todos los estudiantes, alertas y mensajes. "
        "Esto se complementa con WebRTC para el video en tiempo real.",
        styles['Body']
    ))
    story.append(PageBreak())

    # ── 7. API ENDPOINTS ──
    story.append(Paragraph("7. Endpoints API", styles['H1']))

    story.append(Paragraph("7.1 Autenticacion", styles['H2']))
    api_auth = [
        ["Metodo", "Endpoint", "Auth", "Proposito"],
        ["POST", "/api/auth/dev-login", "Ninguna", "Generar JWT de test"],
        ["GET", "/api/auth/get-user", "Bearer", "Obtener perfil del usuario"],
        ["POST", "/api/auth/create-user", "Ninguna", "Crear/actualizar usuario"],
    ]
    story.append(make_table(api_auth[0], api_auth[1:], col_widths=[0.7*inch, 2*inch, 0.8*inch, 3.2*inch]))

    story.append(Paragraph("7.2 Sesiones de Examen", styles['H2']))
    api_exam = [
        ["Metodo", "Endpoint", "Auth", "Proposito"],
        ["POST", "/api/exam-sessions/create", "Bearer", "Crear examen (instructor+)"],
        ["POST", "/api/exam-sessions/join", "Bearer", "Unirse como estudiante"],
        ["GET", "/api/exam-sessions/by-code", "Ninguna", "Buscar examen por codigo"],
        ["GET", "/api/exam-sessions/by-instructor", "Bearer", "Listar examenes propios"],
        ["GET", "/api/exam-sessions/by-student", "Bearer", "Listar examenes inscritos"],
        ["GET", "/api/exam-sessions/[examId]", "Bearer", "Detalle de examen"],
    ]
    story.append(make_table(api_exam[0], api_exam[1:], col_widths=[0.7*inch, 2.5*inch, 0.8*inch, 2.7*inch]))

    story.append(Paragraph("7.3 Tiempo Real y Administracion", styles['H2']))
    api_live = [
        ["Metodo", "Endpoint", "Auth", "Proposito"],
        ["POST", "/api/live", "Ninguna", "Acciones en vivo (join, alert, heartbeat, finish)"],
        ["GET", "/api/live?examId=X", "Ninguna", "Estado del dashboard del instructor"],
        ["POST", "/api/exam/evidence", "Bearer", "Subir snapshot a Supabase Storage"],
        ["GET", "/api/admin/dashboard-data", "Bearer (admin)", "KPIs y datos globales"],
        ["GET/PATCH", "/api/admin/users", "Bearer (admin)", "Gestionar usuarios y roles"],
    ]
    story.append(make_table(api_live[0], api_live[1:], col_widths=[0.8*inch, 2.3*inch, 1*inch, 2.6*inch]))
    story.append(PageBreak())

    # ── 8. ANALISIS DE SEGURIDAD ──
    story.append(Paragraph("8. Analisis de Seguridad", styles['H1']))

    story.append(Paragraph("8.1 Fortalezas", styles['H2']))
    strengths = [
        "Autenticacion Azure AD con verificacion RS256 asimetrica contra JWKS.",
        "Consultas SQL parametrizadas ($1, $2...) en todas las queries, previniendo SQL injection.",
        "Control de acceso basado en roles (RBAC) con verificacion en cada endpoint protegido.",
        "Tokens JWT con expiracion (1h Azure, 24h dev) y claims verificados.",
        "CASCADE DELETE en foreign keys para integridad referencial.",
        "Deteccion de IA ejecutada localmente en el navegador (datos no salen del dispositivo).",
        "Graceful shutdown protocol que asegura persistencia de datos antes de desconexion.",
        "Fallback automatico de conexion (PostgreSQL directo -> REST API) para resiliencia.",
    ]
    for s in strengths:
        story.append(Paragraph(s, styles['BulletItem'], bulletText='\u2713'))

    story.append(Paragraph("8.2 Debilidades Identificadas", styles['H2']))
    weaknesses = [
        "Secreto de tokens de desarrollo hardcodeado en codigo fuente.",
        "Endpoints publicos sin autenticacion (/api/live GET, /api/exam-sessions/by-code).",
        "Sin rate limiting en ningun endpoint (vulnerable a abuso/DDoS).",
        "CORS configurado como '*' (permite cualquier origen).",
        "URLs de evidencia fotografica publicamente accesibles sin autenticacion.",
        "Sin Content Security Policy (CSP) configurado.",
        "Sin audit logging (no se registran cambios de rol, logins, etc.).",
        "Sin servidores TURN para WebRTC (problemas con NAT simetrico).",
    ]
    for w in weaknesses:
        story.append(Paragraph(w, styles['BulletItem'], bulletText='\u2022'))
    story.append(PageBreak())

    # ── 9. HALLAZGOS ──
    story.append(Paragraph("9. Hallazgos y Vulnerabilidades", styles['H1']))

    story.append(Paragraph("9.1 Vulnerabilidades Criticas", styles['H2']))
    vuln_critical = [
        ["#", "Vulnerabilidad", "Impacto", "Estado"],
        ["C1", "Dev token secret hardcodeado en source", "Suplantacion de cualquier rol", "Pendiente"],
        ["C2", "CORS permite cualquier origen (*)", "Ataques cross-site", "Pendiente"],
        ["C3", "Endpoint /api/live sin autenticacion", "Exposicion de datos de estudiantes", "Pendiente"],
    ]
    story.append(make_table(vuln_critical[0], vuln_critical[1:], col_widths=[0.4*inch, 2.5*inch, 2.3*inch, 1.5*inch]))

    story.append(Paragraph("9.2 Vulnerabilidades Altas", styles['H2']))
    vuln_high = [
        ["#", "Vulnerabilidad", "Impacto", "Estado"],
        ["H1", "Sin rate limiting en endpoints", "Abuso, flooding de tokens", "Pendiente"],
        ["H2", "URLs de evidencia publicas", "Violacion de privacidad estudiantil", "Pendiente"],
        ["H3", "Supabase anon key en cliente", "Lectura/escritura de tablas publicas", "Pendiente"],
        ["H4", "Sin validacion de input en alertas", "Posible XSS almacenado", "Pendiente"],
    ]
    story.append(make_table(vuln_high[0], vuln_high[1:], col_widths=[0.4*inch, 2.5*inch, 2.3*inch, 1.5*inch]))

    story.append(Paragraph("9.3 Vulnerabilidades Medias", styles['H2']))
    vuln_medium = [
        ["#", "Vulnerabilidad", "Impacto", "Estado"],
        ["M1", "Face detection al 50% confianza", "Falsos negativos frecuentes", "Pendiente"],
        ["M2", "Solo detecta telefonos (COCO-SSD)", "No detecta smartwatches, notas, etc.", "Pendiente"],
        ["M3", "Sin deteccion de liveness", "Vulnerable a fotos/deepfakes", "Pendiente"],
        ["M4", "Sin audit logging", "No-repudio insuficiente", "Pendiente"],
        ["M5", "Sin CSRF protection", "Ataques cross-site request forgery", "Pendiente"],
        ["M6", "Sin Content Security Policy", "Permite scripts inline, eval()", "Pendiente"],
    ]
    story.append(make_table(vuln_medium[0], vuln_medium[1:], col_widths=[0.4*inch, 2.5*inch, 2.3*inch, 1.5*inch]))
    story.append(PageBreak())

    # ── 10. RECOMENDACIONES ──
    story.append(Paragraph("10. Recomendaciones", styles['H1']))

    story.append(Paragraph("10.1 Inmediatas (Semana 1)", styles['H2']))
    imm = [
        "Rotar todas las credenciales expuestas (Google API Key, DB password, Supabase keys).",
        "Mover DEV_JWT_SECRET a variable de entorno (no hardcodeado).",
        "Restringir CORS a los dominios reales (proctoteam-ugm-orpin.vercel.app).",
        "Agregar autenticacion Bearer a /api/live (GET y POST).",
        "Configurar Supabase Row Level Security (RLS) en todas las tablas.",
    ]
    for i, r in enumerate(imm, 1):
        story.append(Paragraph(f"{i}. {r}", styles['BulletItem']))

    story.append(Paragraph("10.2 Corto Plazo (Mes 1)", styles['H2']))
    short = [
        "Implementar rate limiting (Vercel Edge Middleware o express-rate-limit).",
        "Crear tabla de audit log para registrar todos los cambios de rol, logins y acciones.",
        "Usar URLs firmadas de Supabase (expiracion 15 min) para imagenes de evidencia.",
        "Validar y sanitizar todos los inputs (longitud, tipo, contenido XSS).",
        "Agregar Content Security Policy (CSP) restrictiva en next.config.ts.",
        "Agregar proteccion CSRF o cookies SameSite=Strict.",
    ]
    for i, r in enumerate(short, 1):
        story.append(Paragraph(f"{i}. {r}", styles['BulletItem']))

    story.append(Paragraph("10.3 Mediano Plazo (Trimestre 1)", styles['H2']))
    medium = [
        "Implementar deteccion de liveness (blink, sonrisa) para prevenir fotos/deepfakes.",
        "Entrenar modelo personalizado para objetos especificos de examenes.",
        "Aumentar umbrales de deteccion facial a 75% de confianza.",
        "Integrar gestion de secretos (AWS Secrets Manager o Azure Key Vault).",
        "Agregar monitoreo de errores (Sentry) y APM (Datadog).",
        "Configurar servidores TURN para WebRTC (soporte NAT simetrico).",
        "Realizar pruebas de penetracion con equipo de seguridad externo.",
    ]
    for i, r in enumerate(medium, 1):
        story.append(Paragraph(f"{i}. {r}", styles['BulletItem']))
    story.append(PageBreak())

    # ── 11. ROADMAP ──
    story.append(Paragraph("11. Roadmap de Mejoras", styles['H1']))
    roadmap = [
        ["Fase", "Periodo", "Prioridad", "Actividades"],
        ["Fase 0", "Inmediato", "CRITICA", "Rotar credenciales, fix CORS, auth en /api/live"],
        ["Fase 1", "Mes 1", "ALTA", "Rate limiting, audit log, URLs firmadas, validacion input"],
        ["Fase 2", "Mes 2-3", "ALTA", "CSP, CSRF, Supabase RLS, TURN servers"],
        ["Fase 3", "Mes 3-4", "MEDIA", "Liveness detection, modelo ML custom, Sentry"],
        ["Fase 4", "Mes 5-6", "MEDIA", "Pentest externo, Key Vault, compliance review"],
        ["Fase 5", "Semestre 2", "BAJA", "Zero-trust architecture, load testing 1000+ usuarios"],
    ]
    story.append(make_table(roadmap[0], roadmap[1:], col_widths=[0.8*inch, 1*inch, 1*inch, 3.9*inch]))

    story.append(Spacer(1, 30))
    story.append(hr())
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Este documento es confidencial y de uso interno para el equipo ProctoTeam de la "
        "Universidad Gabriela Mistral. Generado el 10 de Abril de 2026.",
        styles['Footer']
    ))

    doc.build(story)
    print(f"PDF generado exitosamente: {OUTPUT_PATH}")

if __name__ == '__main__':
    build_report()
