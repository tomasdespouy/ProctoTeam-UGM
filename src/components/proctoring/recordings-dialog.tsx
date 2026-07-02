'use client';

import { useState, useEffect, type ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Video, Play, ArrowLeft, User } from 'lucide-react';

interface RecStudent { id: string; name: string }

// Visor de grabaciones de cámara por estudiante. Compartido por el histórico del
// docente y el dashboard del super-admin. Descarga los chunks (URLs firmadas) en
// orden, los concatena en un único webm y lo reproduce.
export function RecordingsDialog({
  examId,
  title,
  token,
  trigger,
}: {
  examId: string;
  title: string;
  token: string | null;
  trigger?: ReactNode;
}) {
  const [open,        setOpen]        = useState(false);
  const [students,    setStudents]    = useState<RecStudent[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected,    setSelected]    = useState<RecStudent | null>(null);
  const [videoUrl,    setVideoUrl]    = useState<string | null>(null);
  const [loadingVid,  setLoadingVid]  = useState(false);
  const [vidError,    setVidError]    = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    setSelected(null);
    fetch(`/api/live?examId=${examId}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => setStudents(
        (data.students ?? []).map((s: any) => ({ id: s.id, name: s.name ?? s.studentId }))
      ))
      .catch(() => setStudents([]))
      .finally(() => setLoadingList(false));
  }, [open, examId]);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const clearVideo = () => {
    setVideoUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const loadVideo = async (student: RecStudent) => {
    setSelected(student);
    setVidError(null);
    setLoadingVid(true);
    clearVideo();
    try {
      const res = await fetch(`/api/exam/recording?participationId=${student.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { chunks } = await res.json();
      if (!chunks || chunks.length === 0) {
        setVidError('No hay grabación para este estudiante. (Solo se graba en exámenes rendidos después de habilitar el almacenamiento.)');
        return;
      }
      const blobs = await Promise.all(chunks.map((u: string) => fetch(u).then(r => r.blob())));
      const full = new Blob(blobs, { type: 'video/webm' });
      setVideoUrl(URL.createObjectURL(full));
    } catch {
      setVidError('No se pudo cargar la grabación.');
    } finally {
      setLoadingVid(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => { setOpen(v); if (!v) { clearVideo(); setSelected(null); } }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            className="flex items-center gap-1.5 h-6 px-2.5 rounded-[5px] border text-xs font-normal transition-colors hover:bg-indigo-50"
            style={{ borderColor: '#6366f1', color: '#242f62' }}
            title="Ver grabaciones de cámara"
          >
            <Video className="h-3 w-3 flex-shrink-0" style={{ color: '#6366f1' }} />
            Grabaciones
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-semibold text-gray-800 leading-tight">
            Grabaciones de cámara
            <span className="ml-2 font-normal text-gray-400">— {title}</span>
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            Video de la webcam de cada estudiante durante el examen.
          </p>
        </DialogHeader>

        <div className="px-5 pb-5 min-h-[220px]">
          {selected ? (
            <div>
              <button
                onClick={() => { setSelected(null); clearVideo(); setVidError(null); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-3"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Volver a la lista
              </button>
              <p className="text-sm font-semibold text-gray-700 mb-2">{selected.name}</p>
              {loadingVid ? (
                <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Cargando grabación…</span>
                </div>
              ) : vidError ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400 text-center px-6">
                  <Video className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{vidError}</p>
                </div>
              ) : videoUrl ? (
                <video src={videoUrl} controls autoPlay className="w-full rounded-lg bg-black max-h-[60vh]" />
              ) : null}
            </div>
          ) : loadingList ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-300">
              <User className="h-8 w-8" />
              <p className="text-sm">Esta sesión no registró estudiantes.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {students.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                    <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <button
                    onClick={() => loadVideo(s)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex-shrink-0"
                  >
                    <Play className="h-3 w-3" /> Ver video
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
