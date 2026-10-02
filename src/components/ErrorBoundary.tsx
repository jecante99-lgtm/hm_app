import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }

  limpiar = async () => {
    // Borra solo la caché de pantallas (no la sesión ni la cola de cambios pendientes)
    Object.keys(localStorage).filter(k => k.startsWith('cache_')).forEach(k => localStorage.removeItem(k));
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map(r => r.unregister()));
    location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6 space-y-4 max-w-md mx-auto">
        <h1 className="text-2xl font-extrabold">Algo salió mal 😕</h1>
        <p className="text-lg">Pulsa el botón para recargar la aplicación. Tus datos están a salvo.</p>
        <button onClick={this.limpiar} className="w-full min-h-14 rounded-2xl bg-marca text-white font-bold text-lg">Recargar</button>
        <pre className="text-sm text-slate-500 whitespace-pre-wrap">{String(this.state.error.message)}</pre>
      </div>
    );
  }
}
