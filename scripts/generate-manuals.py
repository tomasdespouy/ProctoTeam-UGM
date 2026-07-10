# -*- coding: utf-8 -*-
"""
Generador de los 3 manuales de usuario de ProctoTeam UGM (.pptx).
Roles: Estudiante, Docente/Instructor, Administrador (super-admin).

Marca: navy (#1A1D47) + cyan (#00BBFF / #00D4FF), Universidad Gabriela Mistral.
Tipografias: Space Grotesk (titulos) / Inter (cuerpo). Si no estan instaladas,
PowerPoint usa la fuente sustituta mas cercana.

Uso:  python scripts/generate-manuals.py
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ─── Rutas ──────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "manuales")
ASSET_DIR = os.path.join(OUT_DIR, "assets")
LOGO_WHITE = os.path.join(ASSET_DIR, "ugm-logo-white.png")
LOGO_NAVY = os.path.join(ASSET_DIR, "ugm-logo-navy.png")
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Paleta de marca ────────────────────────────────────────────────────────
NAVY = RGBColor(0x1A, 0x1D, 0x47)        # fondo principal oscuro
NAVY2 = RGBColor(0x24, 0x2F, 0x62)       # navy secundario (gradiente)
CYAN = RGBColor(0x00, 0xD4, 0xFF)        # acento cyan
CYAN_BRAND = RGBColor(0x00, 0xBB, 0xFF)  # cyan de marca
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT = RGBColor(0xF2, 0xF4, 0xFA)       # fondo claro sobrio
INK = RGBColor(0x1E, 0x22, 0x42)         # texto oscuro
SLATE = RGBColor(0x5B, 0x63, 0x74)       # texto secundario
SLATE_LT = RGBColor(0x94, 0xA3, 0xB8)
CARD = RGBColor(0xFF, 0xFF, 0xFF)
CARD_LINE = RGBColor(0xE2, 0xE6, 0xF0)

# Severidades de alerta (colores reales del codigo)
CRIT = RGBColor(0xEF, 0x44, 0x44)
WARN = RGBColor(0xF5, 0x9E, 0x0B)
INFO = RGBColor(0x3B, 0x82, 0xF6)
GREEN = RGBColor(0x22, 0xC5, 0x5E)
AMBER = RGBColor(0xF9, 0x73, 0x16)
PURPLE = RGBColor(0x8B, 0x5C, 0xF6)

HEAD_FONT = "Space Grotesk"
BODY_FONT = "Inter"

# Tamano 16:9
SW = Inches(13.333)
SH = Inches(7.5)


# ─── Helpers de bajo nivel ──────────────────────────────────────────────────
def _set_fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def _no_line(shape):
    shape.line.fill.background()


def add_rect(slide, x, y, w, h, color, line=None, line_w=None, rounded=False):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE,
        x, y, w, h,
    )
    if rounded:
        try:
            shp.adjustments[0] = 0.06
        except Exception:
            pass
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    if line is not None:
        shp.line.color.rgb = line
        shp.line.width = line_w or Pt(1)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def add_oval(slide, x, y, d, color):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, d, d)
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def add_text(slide, x, y, w, h, runs, align=PP_ALIGN.LEFT,
             anchor=MSO_ANCHOR.TOP, space_after=Pt(4), line_spacing=1.0,
             wrap=True):
    """runs: lista de parrafos; cada parrafo es lista de (texto, size, color, bold, italic, font)."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, para in enumerate(runs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = space_after
        p.space_before = Pt(0)
        p.line_spacing = line_spacing
        for (text, size, color, bold, italic, font) in para:
            r = p.add_run()
            r.text = text
            r.font.size = Pt(size)
            r.font.color.rgb = color
            r.font.bold = bold
            r.font.italic = italic
            r.font.name = font
    return tb


def R(text, size=14, color=INK, bold=False, italic=False, font=BODY_FONT):
    return (text, size, color, bold, italic, font)


def set_bg(slide, color):
    bg = slide.background
    bg.fill.solid()
    bg.fill.fore_color.rgb = color


def icon_chip(slide, x, y, d, fill, glyph, glyph_color=WHITE, glyph_size=16):
    add_oval(slide, x, y, d, fill)
    add_text(slide, x, y, d, d, [[R(glyph, glyph_size, glyph_color, True, False, BODY_FONT)]],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))


# ─── Plantillas de diapositivas ─────────────────────────────────────────────
def slide_blank(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    return s


def cover_slide(prs, role_title, subtitle, accent_glyph):
    s = slide_blank(prs)
    set_bg(s, NAVY)
    # Bloque diagonal de acento (gradiente simulado con dos rectangulos)
    add_rect(s, Inches(0), Inches(0), SW, Inches(0.14), CYAN)
    add_rect(s, Inches(0), SH - Inches(0.14), SW, Inches(0.14), CYAN)
    # Circulos decorativos
    add_oval(s, Inches(9.7), Inches(-1.3), Inches(4.2), NAVY2)
    add_oval(s, Inches(-1.1), Inches(4.9), Inches(3.0), NAVY2)

    # Logo UGM (blanco)
    if os.path.exists(LOGO_WHITE):
        s.shapes.add_picture(LOGO_WHITE, Inches(0.85), Inches(0.7), height=Inches(0.62))

    # Marca ProctoTeam
    add_text(s, Inches(0.85), Inches(2.0), Inches(11.6), Inches(1.1),
             [[R("Procto", 54, CYAN, True, False, HEAD_FONT), R("Team", 54, WHITE, True, False, HEAD_FONT)]],
             space_after=Pt(0))
    add_text(s, Inches(0.9), Inches(3.05), Inches(11.6), Inches(0.5),
             [[R("Sistema de Vigilancia de Examenes en Linea", 16, CYAN, False, False, BODY_FONT)]],
             space_after=Pt(0))

    # Titulo del manual
    add_text(s, Inches(0.85), Inches(3.95), Inches(11.6), Inches(1.3),
             [[R("Manual del " + role_title, 40, WHITE, True, False, HEAD_FONT)]],
             space_after=Pt(0))
    add_text(s, Inches(0.9), Inches(5.0), Inches(10.8), Inches(0.9),
             [[R(subtitle, 16, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(0), line_spacing=1.15)

    # Pie
    add_text(s, Inches(0.9), Inches(6.55), Inches(11.5), Inches(0.5),
             [[R("Universidad Gabriela Mistral  ·  2026", 12, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(0))
    return s


def section_header_bar(slide, title, kicker, idx=None):
    """Barra superior navy para diapositivas de contenido (fondo claro)."""
    add_rect(slide, Inches(0), Inches(0), SW, Inches(1.18), NAVY)
    add_rect(slide, Inches(0), Inches(1.18), SW, Inches(0.06), CYAN)
    if kicker:
        add_text(slide, Inches(0.85), Inches(0.2), Inches(10.5), Inches(0.32),
                 [[R(kicker.upper(), 11, CYAN, True, False, BODY_FONT)]], space_after=Pt(0))
    add_text(slide, Inches(0.85), Inches(0.48), Inches(11.0), Inches(0.66),
             [[R(title, 26, WHITE, True, False, HEAD_FONT)]], space_after=Pt(0),
             anchor=MSO_ANCHOR.MIDDLE)
    if idx is not None:
        add_text(slide, Inches(12.0), Inches(0.38), Inches(0.9), Inches(0.6),
                 [[R(str(idx), 22, CYAN, True, False, HEAD_FONT)]],
                 align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))


def content_slide(prs, title, kicker, idx=None):
    s = slide_blank(prs)
    set_bg(s, LIGHT)
    section_header_bar(s, title, kicker, idx)
    return s


def footer(slide, role_label):
    add_text(slide, Inches(0.85), Inches(7.18), Inches(8.0), Inches(0.28),
             [[R("ProctoTeam UGM  ·  Manual del " + role_label, 9, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(0))


def toc_slide(prs, role_label, items):
    s = content_slide(prs, "Contenido", "Indice", None)
    # Dos columnas
    col_w = Inches(5.7)
    x1, x2 = Inches(0.85), Inches(6.95)
    half = (len(items) + 1) // 2
    cols = [items[:half], items[half:]]
    xs = [x1, x2]
    rows = max(len(c) for c in cols)
    # Espacio vertical disponible: de 1.65" a 7.0" (deja aire para el footer).
    top = 1.65
    avail = 7.0 - top
    pitch = min(0.82, avail / rows)
    card_h = min(Inches(0.7), Inches(pitch - 0.12))
    cd = float(card_h.inches if hasattr(card_h, "inches") else 0.58)
    for ci, col in enumerate(cols):
        y = Inches(top)
        for (n, label) in col:
            add_rect(s, xs[ci], y, col_w, card_h, CARD, rounded=True)
            circ = min(Inches(0.42), Inches(cd - 0.12))
            cy_off = (card_h - circ) / 2
            add_oval(s, xs[ci] + Inches(0.18), y + cy_off, circ, NAVY)
            add_text(s, xs[ci] + Inches(0.18), y + cy_off, circ, circ,
                     [[R(str(n), 13, CYAN, True, False, HEAD_FONT)]],
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
            add_text(s, xs[ci] + Inches(0.78), y, col_w - Inches(0.95), card_h,
                     [[R(label, 14, INK, True, False, BODY_FONT)]],
                     anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
            y += Inches(pitch)
    return s


def bullets_block(slide, x, y, w, h, items, gap=Pt(8), bullet_color=CYAN_BRAND,
                  size=14, title=None, title_color=NAVY,
                  lead_color=INK, rest_color=SLATE):
    """items: lista de (texto_bold, texto_normal) o solo texto.
    lead_color/rest_color permiten legibilidad sobre fondos oscuros."""
    runs = []
    if title:
        runs.append([R(title, 16, title_color, True, False, HEAD_FONT)])
    for it in items:
        if isinstance(it, tuple):
            lead, rest = it
            para = [R("●  ", 11, bullet_color, True, False, BODY_FONT),
                    R(lead, size, lead_color, True, False, BODY_FONT)]
            if rest:
                para.append(R(rest, size, rest_color, False, False, BODY_FONT))
            runs.append(para)
        else:
            runs.append([R("●  ", 11, bullet_color, True, False, BODY_FONT),
                         R(it, size, lead_color, False, False, BODY_FONT)])
    add_text(slide, x, y, w, h, runs, space_after=gap, line_spacing=1.08)


def step_cards(slide, steps, x=Inches(0.85), y=Inches(1.65), w=Inches(11.6),
               card_h=Inches(0.92), gap=Inches(0.16), num_color=CYAN):
    """steps: lista de (titulo, descripcion)."""
    cy = y
    for i, (t, d) in enumerate(steps, 1):
        add_rect(slide, x, cy, w, card_h, CARD, rounded=True)
        # numero
        add_oval(slide, x + Inches(0.2), cy + (card_h - Inches(0.5)) / 2, Inches(0.5), NAVY)
        add_text(slide, x + Inches(0.2), cy + (card_h - Inches(0.5)) / 2, Inches(0.5), Inches(0.5),
                 [[R(str(i), 17, num_color, True, False, HEAD_FONT)]],
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
        add_text(slide, x + Inches(0.95), cy + Inches(0.1), w - Inches(1.2), card_h - Inches(0.2),
                 [[R(t, 15, INK, True, False, BODY_FONT)],
                  [R(d, 12, SLATE, False, False, BODY_FONT)]],
                 space_after=Pt(2), line_spacing=1.05, anchor=MSO_ANCHOR.MIDDLE)
        cy += card_h + gap


def two_col_cards(slide, left_title, left_items, right_title, right_items,
                  y=Inches(1.7), accentL=NAVY, accentR=AMBER, h=None):
    w = Inches(5.7)
    x1, x2 = Inches(0.85), Inches(6.95)
    # Limita la altura para que la tarjeta no choque con el footer (max ~6.65").
    FOOT_TOP = Inches(6.65)
    if h is None:
        h = min(Inches(4.9), FOOT_TOP - y)
    for x, ttl, items, acc in [(x1, left_title, left_items, accentL),
                               (x2, right_title, right_items, accentR)]:
        add_rect(slide, x, y, w, h, CARD, rounded=True)
        add_rect(slide, x, y, Inches(0.12), h, acc)  # barra lateral de acento
        add_text(slide, x + Inches(0.35), y + Inches(0.25), w - Inches(0.6), Inches(0.5),
                 [[R(ttl, 17, NAVY, True, False, HEAD_FONT)]], space_after=Pt(0))
        bl = []
        for it in items:
            bl.append(it)
        bullets_block(slide, x + Inches(0.35), y + Inches(0.85), w - Inches(0.6), h - Inches(1.0),
                      bl, gap=Pt(7), size=12.5)


def alert_row(slide, x, y, w, label, label_color, desc, sev_text):
    add_rect(slide, x, y, w, Inches(0.62), CARD, rounded=True)
    # pill severidad
    pill = add_rect(slide, x + Inches(0.18), y + Inches(0.16), Inches(1.15), Inches(0.32), label_color, rounded=True)
    add_text(slide, x + Inches(0.18), y + Inches(0.16), Inches(1.15), Inches(0.32),
             [[R(label, 10, WHITE, True, False, BODY_FONT)]],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
    add_text(slide, x + Inches(1.5), y, w - Inches(2.7), Inches(0.62),
             [[R(desc, 12, INK, False, False, BODY_FONT)]],
             anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
    add_text(slide, x + w - Inches(1.15), y, Inches(1.0), Inches(0.62),
             [[R(sev_text, 10, SLATE, False, True, BODY_FONT)]],
             align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))


def stat_callout(slide, x, y, w, big, label, accent):
    add_rect(slide, x, y, w, Inches(1.5), CARD, rounded=True)
    add_rect(slide, x, y, w, Inches(0.1), accent)
    # Auto-ajuste del tamano del valor segun su longitud para no desbordar la caja.
    n = len(str(big))
    big_size = 34 if n <= 6 else (26 if n <= 10 else 22)
    add_text(slide, x + Inches(0.12), y + Inches(0.3), w - Inches(0.24), Inches(0.66),
             [[R(big, big_size, NAVY, True, False, HEAD_FONT)]],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
    add_text(slide, x + Inches(0.15), y + Inches(0.98), w - Inches(0.3), Inches(0.45),
             [[R(label, 11, SLATE, False, False, BODY_FONT)]],
             align=PP_ALIGN.CENTER, space_after=Pt(0), line_spacing=1.0)


def closing_slide(prs, role_label, lines):
    s = slide_blank(prs)
    set_bg(s, NAVY)
    add_rect(s, Inches(0), Inches(0), SW, Inches(0.14), CYAN)
    add_oval(s, Inches(9.9), Inches(-1.0), Inches(3.6), NAVY2)
    if os.path.exists(LOGO_WHITE):
        s.shapes.add_picture(LOGO_WHITE, Inches(0.85), Inches(0.75), height=Inches(0.56))
    add_text(s, Inches(0.85), Inches(2.1), Inches(11.6), Inches(0.9),
             [[R("Soporte y contacto", 34, WHITE, True, False, HEAD_FONT)]], space_after=Pt(0))
    add_text(s, Inches(0.85), Inches(3.05), Inches(11.6), Inches(0.5),
             [[R("Estamos para ayudarte durante todo el proceso de evaluacion.", 15, CYAN, False, False, BODY_FONT)]],
             space_after=Pt(0))
    y = Inches(3.8)
    for lead, rest in lines:
        add_oval(s, Inches(0.9), y + Inches(0.06), Inches(0.16), CYAN)
        add_text(s, Inches(1.25), y, Inches(11.0), Inches(0.5),
                 [[R(lead, 14, WHITE, True, False, BODY_FONT), R(rest, 14, SLATE_LT, False, False, BODY_FONT)]],
                 space_after=Pt(0))
        y += Inches(0.55)
    add_text(s, Inches(0.85), Inches(6.7), Inches(11.6), Inches(0.4),
             [[R("ProctoTeam  ·  Universidad Gabriela Mistral  ·  2026", 11, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(0))
    return s


# ═════════════════════════════════════════════════════════════════════════════
#  MANUAL DEL ESTUDIANTE
# ═════════════════════════════════════════════════════════════════════════════
def build_student():
    prs = Presentation()
    prs.slide_width = SW
    prs.slide_height = SH
    role = "Estudiante"

    # 1 Portada
    cover_slide(prs, "Estudiante",
                "Guia paso a paso para rendir tu examen supervisado: ingreso, verificacion de "
                "identidad, monitoreo en tiempo real y finalizacion.",
                "E")

    # 2 Indice
    toc = [
        (1, "Que es ProctoTeam"),
        (2, "Requisitos previos"),
        (3, "Iniciar sesion (UGM)"),
        (4, "Unirse a un examen"),
        (5, "Declaracion y compromiso"),
        (6, "Verificacion de identidad"),
        (7, "Entrar al monitoreo"),
        (8, "Reglas durante el examen"),
        (9, "Mensajes y ayuda"),
        (10, "Finalizar el examen"),
        (11, "Problemas frecuentes y soporte"),
    ]
    toc_slide(prs, role, toc)

    # 3 Que es
    s = content_slide(prs, "Que es ProctoTeam", "Introduccion", 1)
    add_text(s, Inches(0.85), Inches(1.55), Inches(11.6), Inches(0.9),
             [[R("ProctoTeam es la plataforma de supervision de examenes en linea de la Universidad "
                 "Gabriela Mistral. Durante tu evaluacion comparte tu camara y tu pantalla con el "
                 "docente, que vigila el desarrollo en tiempo real.", 15, INK, False, False, BODY_FONT)]],
             line_spacing=1.2)
    two_col_cards(s,
                  "Lo que el sistema hace", [
                      ("Comparte tu camara ", "y la pantalla completa con el supervisor."),
                      ("Detecta con IA ", "ausencia de rostro y presencia de mas personas."),
                      ("Registra alertas ", "y captura fotos como evidencia."),
                      ("Permite mensajes ", "del supervisor y solicitudes de ayuda."),
                  ],
                  "Lo que necesitas hacer", [
                      ("Tener tu cedula ", "o carnet a mano para verificar identidad."),
                      ("Mantener pantalla completa ", "durante toda la evaluacion."),
                      ("Estar solo ", "en un lugar privado y bien iluminado."),
                      ("No cambiar de pestana ", "ni minimizar la ventana."),
                  ],
                  y=Inches(2.55), accentL=CYAN_BRAND, accentR=NAVY)
    footer(s, role)

    # 4 Requisitos
    s = content_slide(prs, "Requisitos previos", "Antes de empezar", 2)
    step_cards(s, [
        ("Computador con camara web y conexion estable", "Usa un notebook o PC. Los telefonos no son recomendados para rendir."),
        ("Navegador actualizado (Chrome o Edge)", "Necesario para compartir camara y pantalla, y para la pantalla completa."),
        ("Cuenta institucional UGM", "Tu correo de la Universidad Gabriela Mistral para iniciar sesion."),
        ("Documento de identidad", "Cedula o carnet con tu nombre legible para la verificacion."),
        ("Codigo de acceso del examen", "Las 6 letras/numeros que entrega tu docente al iniciar la sala."),
    ], card_h=Inches(0.85), gap=Inches(0.14))
    footer(s, role)

    # 5 Iniciar sesion
    s = content_slide(prs, "Iniciar sesion", "Acceso institucional", 3)
    step_cards(s, [
        ("Abre la plataforma ProctoTeam", "Veras la pantalla de bienvenida con el logo y el acceso institucional."),
        ("Pulsa \"Iniciar Sesion con UGM\"", "Te conecta con tu cuenta Microsoft / Azure de la universidad."),
        ("Autentica con tu correo UGM", "Ingresa tu correo y clave institucional en la ventana de Microsoft."),
        ("Entras al Portal del Estudiante", "El sistema asigna tu rol automaticamente segun tu correo."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.2))
    add_text(s, Inches(0.85), Inches(6.45), Inches(11.6), Inches(0.5),
             [[R("Nota:  ", 12, CYAN_BRAND, True, False, BODY_FONT),
               R("todos los usuarios nuevos entran como Estudiante. El rol no cambia salvo que un "
                 "administrador te promueva.", 12, SLATE, False, False, BODY_FONT)]],
             line_spacing=1.05)
    footer(s, role)

    # 6 Unirse a un examen
    s = content_slide(prs, "Unirse a un examen", "Codigo de acceso", 4)
    step_cards(s, [
        ("Pulsa \"Unirse a un Examen\"", "Boton cyan en el Portal del Estudiante, o usa la tarjeta de la pagina."),
        ("Escribe el Codigo de Acceso", "Son 6 caracteres (ej.: AB12CD). No distingue mayusculas de minusculas."),
        ("Confirma con \"Unirse al Examen\"", "El sistema valida el codigo y te lleva a la sala de tu examen."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.2))
    # tarjeta lateral con campo de codigo de ejemplo
    add_rect(s, Inches(0.85), Inches(5.1), Inches(11.6), Inches(1.4), NAVY, rounded=True)
    add_text(s, Inches(1.2), Inches(5.35), Inches(4.5), Inches(0.9),
             [[R("Codigo de Acceso", 12, CYAN, True, False, BODY_FONT)],
              [R("Lo entrega tu docente al iniciar la sala.", 11, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(4), anchor=MSO_ANCHOR.MIDDLE)
    add_rect(s, Inches(8.0), Inches(5.45), Inches(3.4), Inches(0.7), WHITE, rounded=True)
    add_text(s, Inches(8.0), Inches(5.45), Inches(3.4), Inches(0.7),
             [[R("A B 1 2 C D", 26, NAVY, True, False, HEAD_FONT)]],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
    footer(s, role)

    # 7 Declaracion jurada
    s = content_slide(prs, "Declaracion y compromiso", "Paso 1 de la sala", 5)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.7),
             [[R("Antes de comenzar debes aceptar la ", 14, INK, False, False, BODY_FONT),
               R("Declaracion Jurada y Compromiso", 14, NAVY, True, False, BODY_FONT),
               R(". Al continuar declaras que entiendes y aceptas estas condiciones:", 14, INK, False, False, BODY_FONT)]],
             line_spacing=1.15)
    two_col_cards(s,
                  "Te comprometes a", [
                      ("Compromiso de identidad ", "ser el estudiante inscrito y rendir solo tu."),
                      ("Entorno del examen ", "lugar privado, sin terceras personas."),
                      ("Sin ayuda externa ", "sin material, telefonos ni apoyo de nadie."),
                      ("Monitoreo tecnico ", "aceptas camara, pantalla y captura de imagenes."),
                  ],
                  "Consecuencias", [
                      ("Cada infraccion ", "genera una alerta revisada por tu docente."),
                      ("Faltas graves ", "(otra persona, telefono, cambio de pestanas)."),
                      ("Sancion posible ", "anulacion del examen y/o expulsion."),
                      ("Boton final ", "\"Acepto los Terminos y me Comprometo a Cumplirlos\"."),
                  ],
                  y=Inches(2.35), accentL=NAVY, accentR=CRIT)
    footer(s, role)

    # 8 Verificacion de identidad
    s = content_slide(prs, "Verificacion de identidad", "Paso 2 de la sala", 6)
    step_cards(s, [
        ("Permite el acceso a la camara", "Si aparece error, cierra Zoom/Teams u otras pestanas que la usen."),
        ("Sosten tu documento junto a tu rostro", "Que se vean ambos con claridad, sin reflejos ni desenfoque."),
        ("Pulsa \"Tomar Foto del Documento\"", "La IA lee tu nombre del documento para que lo confirmes."),
        ("Revisa el nombre detectado", "Si es correcto, pulsa \"Confirmar - soy yo\". Si no, \"Volver a tomar\"."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.18))
    add_text(s, Inches(0.85), Inches(6.5), Inches(11.6), Inches(0.4),
             [[R("La foto se guarda como evidencia de identidad. ", 12, SLATE, False, True, BODY_FONT)]])
    footer(s, role)

    # 9 Entrar al monitoreo
    s = content_slide(prs, "Entrar al monitoreo", "Paso 3 de la sala", 7)
    step_cards(s, [
        ("Permite camara y comparte tu pantalla", "Selecciona compartir TODA la pantalla. Es obligatorio para continuar."),
        ("El sistema entra en pantalla completa", "Si no lo hace solo, activala manualmente (F11 en Windows)."),
        ("Aparece el panel \"MONITOREO ACTIVO\"", "Veras tu espejo flotante \"Grabando\" arriba a la derecha."),
        ("Abre tu examen en Blackboard", "Boton \"Abrir Plataforma de Examen (Blackboard)\": se abre en otra pestana."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.18))
    add_text(s, Inches(0.85), Inches(6.5), Inches(11.6), Inches(0.4),
             [[R("Importante:  ", 12, CRIT, True, False, BODY_FONT),
               R("no cierres la ventana de monitoreo mientras rindes en Blackboard.", 12, SLATE, False, False, BODY_FONT)]])
    footer(s, role)

    # 10 Durante el examen + reglas/alertas
    s = content_slide(prs, "Reglas durante el examen", "Lo que debes evitar", 8)
    add_text(s, Inches(0.85), Inches(1.45), Inches(11.6), Inches(0.55),
             [[R("Estas acciones generan una ", 14, INK, False, False, BODY_FONT),
               R("alerta critica", 14, CRIT, True, False, BODY_FONT),
               R(" que tu docente vera de inmediato, junto a una foto:", 14, INK, False, False, BODY_FONT)]])
    alert_row(s, Inches(0.85), Inches(2.15), Inches(11.6), "Critico", CRIT,
              "Salir del modo pantalla completa", "Pantalla")
    alert_row(s, Inches(0.85), Inches(2.9), Inches(11.6), "Critico", CRIT,
              "Cambiar de pestana o minimizar la ventana", "Ventana")
    alert_row(s, Inches(0.85), Inches(3.65), Inches(11.6), "Critico", CRIT,
              "Que la camara no detecte tu rostro (ausencia)", "Ausencia")
    alert_row(s, Inches(0.85), Inches(4.4), Inches(11.6), "Critico", CRIT,
              "Que se detecte mas de una persona en el entorno", "Presencia")
    add_rect(s, Inches(0.85), Inches(5.35), Inches(11.6), Inches(1.15), NAVY, rounded=True)
    add_text(s, Inches(1.2), Inches(5.5), Inches(11.0), Inches(0.85),
             [[R("Si te aparece \"Alerta Critica Registrada\", vuelve de inmediato a pantalla completa. ", 13, WHITE, True, False, BODY_FONT)],
              [R("La deteccion de personas se hace cada pocos segundos con IA en tu propio equipo.", 12, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(4), anchor=MSO_ANCHOR.MIDDLE)
    footer(s, role)

    # 11 Mensajes y ayuda
    s = content_slide(prs, "Mensajes y solicitar ayuda", "Comunicacion", 9)
    two_col_cards(s,
                  "Mensajes del supervisor", [
                      ("Notificacion emergente ", "el docente puede enviarte un mensaje."),
                      ("\"Mensaje del Supervisor\" ", "aparece como aviso en pantalla."),
                      ("Llega en segundos ", "no interrumpe tu examen en Blackboard."),
                      ("Leelo con atencion ", "puede contener instrucciones importantes."),
                  ],
                  "Boton \"Ayuda\"", [
                      ("Esquina inferior izquierda ", "boton \"Ayuda\" siempre visible."),
                      ("Describe tu problema ", "ej.: pantalla negra, duda con una pregunta."),
                      ("Pulsa \"Enviar Solicitud\" ", "el supervisor la revisa por el chat interno."),
                      ("No abandones la sala ", "espera la respuesta sin salir de pantalla completa."),
                  ],
                  y=Inches(1.7), accentL=INFO, accentR=PURPLE)
    footer(s, role)

    # 12 Finalizar
    s = content_slide(prs, "Finalizar el examen", "Cierre", 10)
    step_cards(s, [
        ("Termina y envia tus respuestas en Blackboard", "Asegurate de enviar todo ANTES de cerrar el monitoreo."),
        ("Vuelve a la ventana de ProctoTeam", "Pulsa \"Termine mi examen - Finalizar Monitoreo\"."),
        ("Confirma en el aviso", "Pulsa \"Si, finalizar sesion\" para cerrar la vigilancia."),
        ("Veras \"Monitoreo Finalizado\"", "Vuelve al portal con \"Volver al Portal de Estudiantes\"."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.18))
    add_text(s, Inches(0.85), Inches(6.5), Inches(11.6), Inches(0.4),
             [[R("Si el docente te retira o cierra el examen, veras \"Sesion Interrumpida\" y no podras reingresar.",
                 12, SLATE, False, True, BODY_FONT)]])
    footer(s, role)

    # 13 Problemas frecuentes
    s = content_slide(prs, "Problemas frecuentes", "Soporte", 11)
    two_col_cards(s,
                  "Camara o pantalla no funcionan", [
                      ("\"Permiso denegado\" ", "permite camara y pantalla en el navegador."),
                      ("Camara ocupada ", "cierra Zoom, Teams u otras pestanas y reintenta."),
                      ("No comparte pantalla ", "elige compartir TODA la pantalla, no una ventana."),
                      ("Boton \"Reintentar\" ", "recarga el monitoreo si aparece un error."),
                  ],
                  "Durante el examen", [
                      ("Sali de pantalla completa ", "vuelve a entrar con F11 de inmediato."),
                      ("Se corto la conexion ", "el sistema reintenta reconectar solo."),
                      ("No leyo mi documento ", "mejora la luz, evita reflejos y vuelve a tomar."),
                      ("Dudas del examen ", "usa el boton \"Ayuda\" para avisar al supervisor."),
                  ],
                  y=Inches(1.7), accentL=AMBER, accentR=CYAN_BRAND)
    footer(s, role)

    # 14 Cierre
    closing_slide(prs, role, [
        ("Tu docente  ", "es tu primer contacto para dudas academicas y del examen."),
        ("Boton \"Ayuda\"  ", "disponible durante el monitoreo para avisos en tiempo real."),
        ("Mesa de ayuda UGM  ", "para problemas tecnicos de cuenta o acceso institucional."),
        ("Recomendacion  ", "prueba tu camara y conexion unos minutos antes del examen."),
    ])

    out = os.path.join(OUT_DIR, "Manual_Estudiante_ProctoTeam_UGM.pptx")
    prs.save(out)
    return out, len(prs.slides._sldIdLst)


# ═════════════════════════════════════════════════════════════════════════════
#  MANUAL DEL DOCENTE / INSTRUCTOR
# ═════════════════════════════════════════════════════════════════════════════
def build_instructor():
    prs = Presentation()
    prs.slide_width = SW
    prs.slide_height = SH
    role = "Docente"

    # 1 Portada
    cover_slide(prs, "Docente",
                "Como crear salas de examen, monitorear estudiantes en vivo, gestionar alertas "
                "con evidencia, comunicarte con los alumnos y cerrar la evaluacion.",
                "D")

    # 2 Indice
    toc = [
        (1, "Rol del docente"),
        (2, "Iniciar sesion"),
        (3, "El dashboard"),
        (4, "Crear una sala de examen"),
        (5, "Compartir el codigo"),
        (6, "El Monitor en Vivo"),
        (7, "Grilla de estudiantes"),
        (8, "Panel de alertas"),
        (9, "Severidad de alertas"),
        (10, "Enviar mensaje / retirar"),
        (11, "Exportar e Historico"),
        (12, "Finalizar el examen"),
        (13, "Problemas frecuentes"),
    ]
    toc_slide(prs, role, toc)

    # 3 Rol del docente
    s = content_slide(prs, "Rol del docente", "Introduccion", 1)
    add_text(s, Inches(0.85), Inches(1.55), Inches(11.6), Inches(0.9),
             [[R("Como docente eres el supervisor de la evaluacion. Creas la sala, vigilas a los "
                 "estudiantes en tiempo real mediante video y capturas, revisas las alertas que genera "
                 "el sistema y decides las acciones sobre cada alumno.", 15, INK, False, False, BODY_FONT)]],
             line_spacing=1.2)
    two_col_cards(s,
                  "Puedes hacer", [
                      ("Crear salas ", "con titulo, asignatura, seccion y duracion."),
                      ("Monitorear en vivo ", "video/snapshots de cada estudiante."),
                      ("Gestionar alertas ", "filtrar, ver evidencia y exportar a CSV."),
                      ("Actuar sobre alumnos ", "enviar mensaje o retirar de la evaluacion."),
                      ("Cerrar el examen ", "y revisar el Historico despues."),
                  ],
                  "Necesitas", [
                      ("Cuenta con rol Docente ", "asignada por un administrador."),
                      ("Conexion estable ", "el monitor recibe video por WebRTC."),
                      ("Navegador moderno ", "Chrome o Edge actualizado."),
                      ("Un examen a la vez ", "finaliza el activo antes de crear otro."),
                  ],
                  y=Inches(2.55), accentL=CYAN_BRAND, accentR=NAVY)
    footer(s, role)

    # 4 Iniciar sesion
    s = content_slide(prs, "Iniciar sesion", "Acceso", 2)
    step_cards(s, [
        ("Entra a ProctoTeam y pulsa \"Iniciar Sesion con UGM\"", "Autenticacion con tu cuenta Microsoft / Azure institucional."),
        ("El sistema reconoce tu rol", "Si eres Docente, entras directo al Portal del Docente."),
        ("No ves opciones de docente?", "Pide a un administrador que te promueva a rol Docente."),
    ], y=Inches(1.75), card_h=Inches(1.05), gap=Inches(0.22))
    add_text(s, Inches(0.85), Inches(6.4), Inches(11.6), Inches(0.5),
             [[R("El rol se asigna por correo institucional y solo un Super Admin puede cambiarlo desde Gestion de Usuarios.",
                 12, SLATE, False, True, BODY_FONT)]], line_spacing=1.05)
    footer(s, role)

    # 5 Dashboard
    s = content_slide(prs, "El dashboard del docente", "Portal del Docente", 3)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("Al ingresar veras tu panel de bienvenida con accesos directos y el formulario para crear salas.",
                 14, INK, False, False, BODY_FONT)]])
    step_cards(s, [
        ("Boton \"Monitor en Vivo\"", "Abre el monitoreo del examen activo (si lo hay)."),
        ("Boton \"Ver Historico\"", "Lista de examenes pasados con sus alertas y evidencias."),
        ("Aviso \"Examen en Curso\"", "Si tienes una sesion activa, usa \"Retomar Monitoreo\"."),
        ("Formulario \"Crear Nueva Sala de Examen\"", "Disponible solo cuando no tienes examenes activos."),
    ], y=Inches(2.15), card_h=Inches(0.95), gap=Inches(0.16))
    footer(s, role)

    # 6 Crear sala
    s = content_slide(prs, "Crear una sala de examen", "Configuracion", 4)
    step_cards(s, [
        ("Titulo del Examen", "Ej.: Evaluacion Solemne 1."),
        ("Asignatura y Seccion / Grupo", "Ej.: Calculo I  ·  Seccion 004D."),
        ("Duracion (minutos)", "Tiempo de la evaluacion; alimenta el cronometro del monitor."),
        ("Codigo de Acceso", "Se genera automatico (6 caracteres). Puedes regenerarlo o copiarlo."),
        ("Pulsa \"Crear Sala y Monitorear\"", "Te lleva directo al Monitor en Vivo de esa sala."),
    ], y=Inches(1.65), card_h=Inches(0.86), gap=Inches(0.14))
    footer(s, role)

    # 7 Compartir codigo
    s = content_slide(prs, "Compartir el codigo de acceso", "Antes de iniciar", 5)
    add_text(s, Inches(0.85), Inches(1.55), Inches(11.6), Inches(0.6),
             [[R("Tus estudiantes necesitan el codigo de 6 caracteres para unirse. Lo encuentras en el "
                 "formulario al crear la sala y en el encabezado del Monitor en Vivo.", 14, INK, False, False, BODY_FONT)]],
             line_spacing=1.15)
    add_rect(s, Inches(0.85), Inches(2.5), Inches(11.6), Inches(1.5), NAVY, rounded=True)
    add_text(s, Inches(1.2), Inches(2.75), Inches(5.5), Inches(1.0),
             [[R("Codigo de acceso", 13, CYAN, True, False, BODY_FONT)],
              [R("Dictalo o compartelo con tu curso. El boton de copiar lo deja en el portapapeles.",
                 12, SLATE_LT, False, False, BODY_FONT)]],
             space_after=Pt(5), anchor=MSO_ANCHOR.MIDDLE, line_spacing=1.1)
    add_rect(s, Inches(8.4), Inches(2.85), Inches(3.4), Inches(0.8), WHITE, rounded=True)
    add_text(s, Inches(8.4), Inches(2.85), Inches(3.4), Inches(0.8),
             [[R("A B 1 2 C D", 28, NAVY, True, False, HEAD_FONT)]],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=Pt(0))
    bullets_block(s, Inches(0.85), Inches(4.4), Inches(11.6), Inches(2.2), [
        ("Comparte el codigo ", "al inicio de la evaluacion; cada alumno se une con el."),
        ("Cada estudiante ", "acepta la declaracion, verifica identidad y comparte camara + pantalla."),
        ("Veras a los alumnos ", "aparecer en la grilla del monitor a medida que ingresan."),
    ], title="Como lo usan tus estudiantes", gap=Pt(9))
    footer(s, role)

    # 8 Monitor en vivo
    s = content_slide(prs, "El Monitor en Vivo", "Vigilancia en tiempo real", 6)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("Es la pantalla central de supervision. En la parte superior tienes el estado y los indicadores clave.",
                 14, INK, False, False, BODY_FONT)]])
    stat_callout(s, Inches(0.85), Inches(2.2), Inches(2.75), "0", "Estudiantes Activos", CYAN_BRAND)
    stat_callout(s, Inches(3.85), Inches(2.2), Inches(2.75), "00:00", "Tiempo de Monitoreo", NAVY)
    stat_callout(s, Inches(6.85), Inches(2.2), Inches(2.75), "0", "Estudiantes con Alertas", CRIT)
    stat_callout(s, Inches(9.85), Inches(2.2), Inches(2.6), "0", "Total de Alertas", GREEN)
    bullets_block(s, Inches(0.85), Inches(4.1), Inches(11.6), Inches(2.4), [
        ("Indicador \"Tiempo real\" ", "(verde) confirma la conexion en vivo; \"Conectando...\" si se reconecta."),
        ("Codigo de acceso ", "visible y copiable en el encabezado para dictarlo a rezagados."),
        ("Cronometro ", "muestra tiempo restante segun la duracion, o \"Tiempo excedido\"."),
        ("Boton rojo \"Finalizar Examen\" ", "cierra la sala (ver diapositiva de cierre)."),
    ], title="Encabezado del monitor", gap=Pt(9))
    footer(s, role)

    # 9 Grilla de estudiantes
    s = content_slide(prs, "Grilla de estudiantes", "Monitoreo de estudiantes", 7)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("Cada estudiante aparece como una celda con su video en vivo (camara + pantalla) o su ultima foto.",
                 14, INK, False, False, BODY_FONT)]])
    two_col_cards(s,
                  "Que ves en cada celda", [
                      ("Nombre y estado ", "\"activo\" o \"inactivo\" del estudiante."),
                      ("Video o snapshot ", "camara y pantalla compartida (PiP)."),
                      ("Contador de alertas ", "numero rojo si acumula incidencias."),
                      ("Clic para maximizar ", "abre el detalle a pantalla grande."),
                  ],
                  "En la vista maximizada", [
                      ("Video ampliado ", "camara y pantalla del estudiante."),
                      ("Campo de mensaje ", "para escribirle directamente."),
                      ("\"Retirar de la evaluacion\" ", "lo bloquea de la sesion."),
                      ("Cerrar con la X o ESC ", "vuelve a la grilla."),
                  ],
                  y=Inches(2.2), accentL=NAVY, accentR=CYAN_BRAND)
    footer(s, role)

    # 10 Panel de alertas
    s = content_slide(prs, "Panel de alertas", "Incidencias", 8)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("Bajo la grilla, el panel lista las alertas mas recientes con estudiante, descripcion y hora.",
                 14, INK, False, False, BODY_FONT)]])
    bullets_block(s, Inches(0.85), Inches(2.15), Inches(11.6), Inches(3.0), [
        ("Filtros ", "\"Todos\", \"Criticos\", \"Advertencias\", \"Info\"."),
        ("Boton \"Foto\" ", "abre la evidencia fotografica capturada en el momento de la alerta."),
        ("Hora exacta ", "cada alerta muestra su marca de tiempo."),
        ("\"Exportar alertas\" ", "descarga un CSV con timestamp, estudiante, severidad y descripcion."),
        ("Tiempo real ", "las alertas aparecen automaticamente sin recargar."),
    ], gap=Pt(11), size=14)
    footer(s, role)

    # 11 Severidad
    s = content_slide(prs, "Severidad de las alertas", "Como interpretarlas", 9)
    add_text(s, Inches(0.85), Inches(1.45), Inches(11.6), Inches(0.45),
             [[R("El sistema clasifica cada incidencia en tres niveles segun su gravedad:", 14, INK, False, False, BODY_FONT)]])
    alert_row(s, Inches(0.85), Inches(2.1), Inches(11.6), "Critico", CRIT,
              "Salir de pantalla completa, cambiar de pestana, ausencia o varias personas", "Maxima")
    alert_row(s, Inches(0.85), Inches(2.85), Inches(11.6), "Advertencia", WARN,
              "Perdida temporal de senal de camara/pantalla o de conexion", "Media")
    alert_row(s, Inches(0.85), Inches(3.6), Inches(11.6), "Info", INFO,
              "Eventos informativos y solicitudes de ayuda del estudiante", "Baja")
    add_rect(s, Inches(0.85), Inches(4.6), Inches(11.6), Inches(1.9), NAVY, rounded=True)
    bullets_block(s, Inches(1.2), Inches(4.85), Inches(11.0), Inches(1.5), [
        ("Cada alerta puede traer foto ", "captura del momento exacto para auditar."),
        ("Las criticas son inmediatas ", "no esperan enfriamiento; aparecen al instante."),
        ("Solicitud de Ayuda ", "el estudiante puede pedir asistencia y queda registrada."),
    ], title="Buenas practicas", gap=Pt(8), size=12.5, title_color=CYAN,
        lead_color=WHITE, rest_color=SLATE_LT)
    footer(s, role)

    # 12 Acciones sobre estudiantes
    s = content_slide(prs, "Enviar mensaje y retirar", "Acciones sobre el alumno", 10)
    two_col_cards(s,
                  "Enviar un mensaje", [
                      ("Maximiza al estudiante ", "clic en su celda de video."),
                      ("Escribe en el campo ", "\"Enviar un mensaje a [nombre]...\"."),
                      ("Pulsa \"Enviar\" ", "le llega como notificacion en segundos."),
                      ("Util para ", "avisos, advertencias o instrucciones puntuales."),
                  ],
                  "Retirar de la evaluacion", [
                      ("Boton \"Retirar de la evaluacion\" ", "en la vista maximizada."),
                      ("Confirma la accion ", "es irreversible para esa sesion."),
                      ("El alumno ve ", "\"Sesion Interrumpida\" y no puede reingresar."),
                      ("Su sesion se cierra ", "automaticamente en pocos segundos."),
                  ],
                  y=Inches(1.7), accentL=INFO, accentR=CRIT)
    footer(s, role)

    # 13 Exportar e historico
    s = content_slide(prs, "Exportar e Historico", "Despues del examen", 11)
    step_cards(s, [
        ("Exporta las alertas a CSV", "Desde el panel de alertas, boton \"Exportar alertas\"."),
        ("Abre \"Ver Historico\"", "Lista de tus examenes finalizados con su detalle."),
        ("Revisa alertas y evidencias", "Filtra por severidad y abre cada foto de evidencia."),
        ("Descarga el reporte", "Exporta el CSV completo de cada examen para tus registros."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.18))
    footer(s, role)

    # 14 Finalizar
    s = content_slide(prs, "Finalizar el examen", "Cierre de la sala", 12)
    step_cards(s, [
        ("Pulsa \"Finalizar Examen\"", "Boton rojo en el encabezado del Monitor en Vivo."),
        ("Confirma \"Si, finalizar examen\"", "Cierra todas las sesiones de los estudiantes. Es irreversible."),
        ("Espera la sincronizacion", "Veras \"Sincronizando evidencias...\"; no cierres la pestana."),
        ("Te lleva al Historico", "El examen queda registrado con todas sus alertas y evidencias."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.18))
    add_text(s, Inches(0.85), Inches(6.5), Inches(11.6), Inches(0.4),
             [[R("Recuerda: solo puedes tener un examen activo a la vez. Finaliza el actual antes de crear otro.",
                 12, SLATE, False, True, BODY_FONT)]])
    footer(s, role)

    # 15 Problemas frecuentes
    s = content_slide(prs, "Problemas frecuentes", "Soporte", 13)
    two_col_cards(s,
                  "Monitoreo", [
                      ("No veo el video de un alumno ", "espera unos segundos; vera su ultima foto."),
                      ("Dice \"Conectando...\" ", "es una reconexion automatica; suele resolverse."),
                      ("\"Esperando conexion\" ", "aun no se han unido estudiantes con el codigo."),
                      ("Celda en gris/inactivo ", "el alumno perdio conexion o salio."),
                  ],
                  "Gestion", [
                      ("No puedo crear una sala ", "finaliza tu examen activo primero."),
                      ("El alumno no entra ", "verifica que use el codigo correcto (6 caracteres)."),
                      ("No aparezco como docente ", "pide tu promocion al administrador."),
                      ("Exportacion vacia ", "no hay alertas registradas aun para ese filtro."),
                  ],
                  y=Inches(1.7), accentL=AMBER, accentR=NAVY)
    footer(s, role)

    # 16 Cierre
    closing_slide(prs, role, [
        ("Administrador (Super Admin)  ", "para cambios de rol, accesos y soporte de plataforma."),
        ("Mesa de ayuda UGM  ", "para incidencias tecnicas de cuenta institucional."),
        ("Recomendacion  ", "crea la sala con anticipacion y dicta el codigo al iniciar."),
        ("Buena practica  ", "exporta las alertas a CSV al cerrar cada evaluacion."),
    ])

    out = os.path.join(OUT_DIR, "Manual_Docente_ProctoTeam_UGM.pptx")
    prs.save(out)
    return out, len(prs.slides._sldIdLst)


# ═════════════════════════════════════════════════════════════════════════════
#  MANUAL DEL ADMINISTRADOR (SUPER-ADMIN)
# ═════════════════════════════════════════════════════════════════════════════
def build_admin():
    prs = Presentation()
    prs.slide_width = SW
    prs.slide_height = SH
    role = "Administrador"

    # 1 Portada
    cover_slide(prs, "Administrador",
                "Vision global del sistema de proctoring: Centro de Mando, gestion de usuarios y roles, "
                "auditoria de alertas con IA y monitoreo en Modo Fantasma.",
                "A")

    # 2 Indice
    toc = [
        (1, "Rol del administrador"),
        (2, "Iniciar sesion"),
        (3, "Centro de Mando Global"),
        (4, "Indicadores (KPIs)"),
        (5, "Auditoria de examenes"),
        (6, "Alertas por examen"),
        (7, "Gestion de usuarios"),
        (8, "Cambiar roles"),
        (9, "Auditoria IA global"),
        (10, "Modo Fantasma"),
        (11, "Buenas practicas"),
        (12, "Problemas frecuentes"),
    ]
    toc_slide(prs, role, toc)

    # 3 Rol
    s = content_slide(prs, "Rol del administrador", "Introduccion", 1)
    add_text(s, Inches(0.85), Inches(1.55), Inches(11.6), Inches(0.9),
             [[R("El Super Admin tiene la vision supervisora de toda la plataforma: ve todas las sesiones de "
                 "todos los docentes, administra los usuarios y sus roles, y audita las alertas generadas por la "
                 "IA. No crea examenes; su funcion es de supervision y administracion.", 15, INK, False, False, BODY_FONT)]],
             line_spacing=1.2)
    two_col_cards(s,
                  "Puede hacer", [
                      ("Ver todas las sesiones ", "de cualquier docente, activas o pasadas."),
                      ("Gestionar usuarios ", "y promover a Docente o Super Admin."),
                      ("Auditar alertas ", "feed global con metricas y evidencias."),
                      ("Monitorear en Modo Fantasma ", "observar un examen sin intervenir."),
                  ],
                  "No hace / limites", [
                      ("No crea examenes ", "esa funcion es exclusiva del docente."),
                      ("No finaliza salas ajenas ", "en Modo Fantasma es solo lectura."),
                      ("No elimina el ultimo admin ", "el sistema lo impide por seguridad."),
                      ("Datos sensibles enmascarados ", "correos parcialmente ocultos en auditoria."),
                  ],
                  y=Inches(2.55), accentL=AMBER, accentR=NAVY)
    footer(s, role)

    # 4 Iniciar sesion
    s = content_slide(prs, "Iniciar sesion", "Acceso", 2)
    step_cards(s, [
        ("Entra a ProctoTeam y pulsa \"Iniciar Sesion con UGM\"", "Mismo acceso institucional; el sistema detecta tu rol."),
        ("Redireccion automatica", "Con rol Super Admin entras al Centro de Mando Global."),
        ("Menu Super Admin", "Accede a Dashboard, Gestion de Usuarios y Auditoria IA."),
    ], y=Inches(1.75), card_h=Inches(1.05), gap=Inches(0.22))
    add_text(s, Inches(0.85), Inches(6.4), Inches(11.6), Inches(0.5),
             [[R("El acceso de Super Admin esta protegido: las paginas validan tu rol en el servidor en cada visita.",
                 12, SLATE, False, True, BODY_FONT)]], line_spacing=1.05)
    footer(s, role)

    # 5 Centro de mando
    s = content_slide(prs, "Centro de Mando Global", "Dashboard", 3)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.6),
             [[R("Es tu pantalla principal: vision unificada del sistema de proctoring, con indicadores "
                 "en tiempo real y la tabla de auditoria de todos los examenes.", 14, INK, False, False, BODY_FONT)]],
             line_spacing=1.15)
    step_cards(s, [
        ("Cabecera \"Super Admin\"", "Titulo \"Centro de Mando Global\" y fecha del dia."),
        ("Fila de KPIs", "Cuatro tarjetas con metricas globales (ver siguiente)."),
        ("Tabla \"Auditoria de Examenes\"", "Todas las sesiones con docente, alumnos y alertas."),
        ("Buscador", "Filtra por titulo, docente o materia."),
    ], y=Inches(2.2), card_h=Inches(0.92), gap=Inches(0.16))
    footer(s, role)

    # 6 KPIs
    s = content_slide(prs, "Indicadores globales (KPIs)", "Metricas en vivo", 4)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("Las cuatro tarjetas resumen el estado del sistema de un vistazo:", 14, INK, False, False, BODY_FONT)]])
    stat_callout(s, Inches(0.85), Inches(2.2), Inches(2.75), "0", "Sesiones Activas (LIVE)", GREEN)
    stat_callout(s, Inches(3.85), Inches(2.2), Inches(2.75), "0", "Examenes Realizados", INFO)
    stat_callout(s, Inches(6.85), Inches(2.2), Inches(2.75), "0", "Docentes Activos", AMBER)
    stat_callout(s, Inches(9.85), Inches(2.2), Inches(2.6), "0", "Base de Estudiantes", PURPLE)
    bullets_block(s, Inches(0.85), Inches(4.1), Inches(11.6), Inches(2.3), [
        ("Sesiones Activas ", "examenes monitoreando en este momento (marca LIVE)."),
        ("Examenes Realizados ", "total de sesiones registradas en la plataforma."),
        ("Docentes Activos ", "cuentas con permisos de staff (Docente o Admin)."),
        ("Base de Estudiantes ", "total de alumnos registrados en el sistema."),
    ], title="Que significa cada uno", gap=Pt(10))
    footer(s, role)

    # 7 Auditoria de examenes
    s = content_slide(prs, "Auditoria de examenes", "Tabla global", 5)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("La tabla lista cada examen del sistema. Columnas: Estado, Examen/Materia, Docente, Alumnos, Alertas y Fecha.",
                 14, INK, False, False, BODY_FONT)]])
    two_col_cards(s,
                  "Estados de un examen", [
                      ("\"EN VIVO\" ", "(verde) el examen se esta rindiendo ahora."),
                      ("\"Pendiente\" ", "creado, aun sin iniciar."),
                      ("\"Finalizado\" ", "ya cerrado por el docente."),
                      ("Codigo de acceso ", "visible junto a cada examen."),
                  ],
                  "Acciones en la fila", [
                      ("Contador de alertas ", "lleva a la Auditoria IA detallada."),
                      ("Boton ojo ", "abre el panel lateral de alertas del examen."),
                      ("Filtra por severidad ", "criticas, advertencias e info."),
                      ("\"Descargar CSV completo\" ", "exporta las alertas de ese examen."),
                  ],
                  y=Inches(2.2), accentL=NAVY, accentR=CYAN_BRAND)
    footer(s, role)

    # 8 Alertas por examen
    s = content_slide(prs, "Alertas por examen", "Panel lateral", 6)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("Al pulsar el ojo de un examen se abre un panel con todas sus alertas e incidencias.",
                 14, INK, False, False, BODY_FONT)]])
    bullets_block(s, Inches(0.85), Inches(2.15), Inches(11.6), Inches(3.2), [
        ("Cabecera ", "muestra materia, titulo, fecha y docente del examen."),
        ("Chips de filtro ", "Todas, Criticas, Advertencias, Info y cuantas tienen foto."),
        ("Cada alerta ", "trae estudiante, descripcion, fecha/hora y barra de color por severidad."),
        ("\"Ver Foto\" ", "abre la evidencia fotografica de la incidencia."),
        ("\"Descargar CSV completo\" ", "exporta todas las alertas del examen seleccionado."),
        ("Funciona para cualquier examen ", "no solo los activos; tambien historicos."),
    ], gap=Pt(10), size=14)
    footer(s, role)

    # 9 Gestion de usuarios
    s = content_slide(prs, "Gestion de usuarios", "Directorio", 7)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("En \"Gestion de Usuarios\" administras roles y permisos de todos los usuarios registrados.",
                 14, INK, False, False, BODY_FONT)]])
    # pills resumen
    stat_callout(s, Inches(0.85), Inches(2.15), Inches(3.6), "Estudiantes", "Rol por defecto de todo usuario nuevo", SLATE_LT)
    stat_callout(s, Inches(4.85), Inches(2.15), Inches(3.6), "Docentes", "Pueden crear y supervisar examenes", INFO)
    stat_callout(s, Inches(8.85), Inches(2.15), Inches(3.6), "Super Admins", "Supervision y administracion global", AMBER)
    bullets_block(s, Inches(0.85), Inches(4.05), Inches(11.6), Inches(2.4), [
        ("Directorio buscable ", "filtra por nombre o email."),
        ("Resumen por rol ", "pildoras con el conteo de cada tipo de usuario."),
        ("Examenes creados ", "y fechas de registro y ultima actividad por usuario."),
        ("Boton \"Actualizar\" ", "recarga el directorio con los datos mas recientes."),
    ], title="Que ves en la tabla", gap=Pt(9))
    footer(s, role)

    # 10 Cambiar roles
    s = content_slide(prs, "Cambiar el rol de un usuario", "Promover / degradar", 8)
    step_cards(s, [
        ("Ubica al usuario", "Busca por nombre o email en el directorio."),
        ("Pulsa \"Cambiar rol\"", "Despliega las opciones: Estudiante, Docente, Super Admin."),
        ("Selecciona el nuevo rol", "El cambio se aplica de inmediato y se confirma con un aviso."),
        ("Verificacion de seguridad", "El sistema impide quitar el ultimo Super Admin."),
    ], y=Inches(1.7), card_h=Inches(1.0), gap=Inches(0.18))
    add_text(s, Inches(0.85), Inches(6.5), Inches(11.6), Inches(0.4),
             [[R("Recuerda: todo usuario nuevo entra como Estudiante; promover a Docente es la accion mas comun.",
                 12, SLATE, False, True, BODY_FONT)]])
    footer(s, role)

    # 11 Auditoria IA
    s = content_slide(prs, "Auditoria IA global", "Feed de alertas", 9)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.5),
             [[R("La pagina \"Auditoria IA\" reune el feed global de alertas del motor de deteccion inteligente.",
                 14, INK, False, False, BODY_FONT)]])
    stat_callout(s, Inches(0.85), Inches(2.2), Inches(3.7), "Hoy", "Total de alertas del dia por severidad", INFO)
    stat_callout(s, Inches(4.9), Inches(2.2), Inches(3.6), "7 dias", "Tipo de alerta mas frecuente", AMBER)
    stat_callout(s, Inches(8.85), Inches(2.2), Inches(3.6), "Evidencia", "Alertas con foto adjunta disponible", GREEN)
    bullets_block(s, Inches(0.85), Inches(4.1), Inches(11.6), Inches(2.3), [
        ("Tabla \"Feed de Alertas Recientes\" ", "fecha/hora, examen, estudiante, tipo y severidad."),
        ("Email enmascarado ", "se protege la identidad del estudiante en la auditoria."),
        ("\"Ver Foto\" ", "abre la evidencia cuando existe snapshot."),
        ("Buscador ", "filtra por materia o tipo de alerta."),
    ], title="Que encuentras aqui", gap=Pt(10))
    footer(s, role)

    # 12 Modo Fantasma
    s = content_slide(prs, "Modo Fantasma (solo lectura)", "Supervision en vivo", 10)
    add_text(s, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.6),
             [[R("Permite observar un examen activo en tiempo real sin intervenir. Reutiliza el Monitor en Vivo "
                 "del docente, pero en modo lectura.", 14, INK, False, False, BODY_FONT)]], line_spacing=1.15)
    step_cards(s, [
        ("Desde el dashboard, examen \"EN VIVO\"", "El boton de monitoreo solo se habilita para examenes activos."),
        ("Se abre el monitor en lectura", "Veras la grilla de estudiantes y el panel de alertas en vivo."),
        ("Insignia \"Modo Lectura\"", "Indicador ambar que confirma que no puedes intervenir."),
        ("Sin acciones destructivas", "No aparece \"Finalizar Examen\"; no afectas la sesion del docente."),
    ], y=Inches(2.25), card_h=Inches(0.9), gap=Inches(0.16))
    footer(s, role)

    # 13 Buenas practicas
    s = content_slide(prs, "Buenas practicas", "Recomendaciones", 11)
    two_col_cards(s,
                  "Gestion de usuarios", [
                      ("Promueve con criterio ", "asigna Docente solo a quien lo necesita."),
                      ("Limita los Super Admin ", "manten pocos administradores globales."),
                      ("Revisa el directorio ", "periodicamente para mantenerlo al dia."),
                      ("Nunca dejes cero admins ", "el sistema te protege, pero verifica."),
                  ],
                  "Auditoria y supervision", [
                      ("Revisa la Auditoria IA ", "a diario para detectar patrones."),
                      ("Exporta CSV ", "de examenes con muchas incidencias."),
                      ("Usa Modo Fantasma ", "para apoyar a docentes en examenes criticos."),
                      ("Protege la evidencia ", "respeta la confidencialidad de los datos."),
                  ],
                  y=Inches(1.7), accentL=AMBER, accentR=NAVY)
    footer(s, role)

    # 14 Problemas frecuentes
    s = content_slide(prs, "Problemas frecuentes", "Soporte", 12)
    two_col_cards(s,
                  "Acceso y roles", [
                      ("Un docente no ve su panel ", "verifica que tenga rol Docente asignado."),
                      ("No puedo quitar un admin ", "no se permite eliminar el ultimo Super Admin."),
                      ("Cambio de rol no aplica ", "pulsa \"Actualizar\" y reintenta."),
                      ("Usuario no aparece ", "debe iniciar sesion al menos una vez."),
                  ],
                  "Datos y monitoreo", [
                      ("KPIs en cero ", "puede no haber actividad o sesiones aun."),
                      ("Ojo deshabilitado ", "el examen no esta activo (solo activos en vivo)."),
                      ("Alerta sin foto ", "no se capturo evidencia en ese evento."),
                      ("Tabla vacia ", "ajusta el buscador o revisa el filtro aplicado."),
                  ],
                  y=Inches(1.7), accentL=CRIT, accentR=CYAN_BRAND)
    footer(s, role)

    # 15 Cierre
    closing_slide(prs, role, [
        ("Equipo de TI / Plataforma UGM  ", "para incidencias de infraestructura, base de datos o despliegue."),
        ("Soporte Microsoft / Azure  ", "para problemas de autenticacion institucional (SSO)."),
        ("Docentes  ", "coordina con ellos las salas, codigos y casos de estudiantes."),
        ("Recomendacion  ", "documenta los cambios de rol y revisa la auditoria con regularidad."),
    ])

    out = os.path.join(OUT_DIR, "Manual_Administrador_ProctoTeam_UGM.pptx")
    prs.save(out)
    return out, len(prs.slides._sldIdLst)


if __name__ == "__main__":
    for fn in (build_student, build_instructor, build_admin):
        path, n = fn()
        print(f"OK  {os.path.basename(path)}  -> {n} diapositivas  ({path})")
