import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

const COPY = {
  es: {
    title: 'Política de privacidad',
    updated: 'Última actualización: septiembre de 2026',
    intro:
      'Esta aplicación guarda tu cuenta y tus datos de planificación. El responsable del tratamiento es Cerebro Studios.',
    accountTitle: 'Cuenta',
    accountBody:
      'El acceso usa Google o email y contraseña a través de Supabase Auth. Guardamos el email y el nombre que nos das al crear la cuenta.',
    dataTitle: 'Qué datos tratamos',
    dataBody:
      'Tareas, recordatorios, recetario, contactos, notas, hábitos y datos de finanzas asociados a tu cuenta. Los importes y metadatos financieros sensibles se almacenan cifrados de cuenta. No vendemos tus datos.',
    infraTitle: 'Infraestructura',
    infraBody:
      'Autenticación y base de datos: Supabase (PostgreSQL). API propia para mutaciones, notificaciones por correo (si las activas) y operaciones de cuenta.',
    logsTitle: 'Registros técnicos',
    logsBody:
      'Los fallos de servidor pueden guardar un registro operativo. Al borrar la cuenta anonimizamos esos registros (sin uid ni IP) en lugar de usarlos como ficha personal.',
    deleteTitle: 'Borrar tus datos',
    deleteBody:
      'Puedes solicitar la eliminación de tu cuenta. Eso borra el perfil y, en cascada, tareas, proyectos, contactos, notas, finanzas y entregas de notificación.',
    contact: 'Contacto: fafrancod@gmail.com',
    backLogin: 'Volver al acceso',
    backApp: 'Volver a la app',
  },
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: September 2026',
    intro:
      'This app stores your account and planning data. The controller is Cerebro Studios.',
    accountTitle: 'Account',
    accountBody:
      'Sign-in uses Google or email and password via Supabase Auth. We store the email and name you provide when you create the account.',
    dataTitle: 'What we process',
    dataBody:
      'Tasks, reminders, prescriptions, contacts, notes, habits, and finance data tied to your account. Amounts and sensitive finance metadata are stored encrypted at rest for your account. We do not sell your data.',
    infraTitle: 'Infrastructure',
    infraBody:
      'Auth and database: Supabase (PostgreSQL). Our API handles mutations, email notifications (if you enable them), and account operations.',
    logsTitle: 'Technical logs',
    logsBody:
      'Server failures may write an ops log. When you delete your account we anonymize those rows (no uid or IP) instead of treating them as a personal file.',
    deleteTitle: 'Deleting your data',
    deleteBody:
      'You can request account deletion. That removes the profile and, in cascade, tasks, projects, contacts, notes, finances, and notification deliveries.',
    contact: 'Contact: fafrancod@gmail.com',
    backLogin: 'Back to sign in',
    backApp: 'Back to the app',
  },
} as const;

export function PrivacyPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const copy = COPY[settings.language === 'en' ? 'en' : 'es'];
  const home = user ? '/board' : '/login';
  const homeLabel = user ? copy.backApp : copy.backLogin;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-accent-teal" />
          <p className="text-sm font-bold tracking-tight text-text-primary">Daily Tracker</p>
        </div>
        <h1 className="text-xl font-semibold text-text-primary">{copy.title}</h1>
        <p className="mt-1 text-xs text-text-muted">{copy.updated}</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-text-primary">
          <p>{copy.intro}</p>
          <section>
            <h2 className="mb-1 font-semibold">{copy.accountTitle}</h2>
            <p className="text-text-muted">{copy.accountBody}</p>
          </section>
          <section>
            <h2 className="mb-1 font-semibold">{copy.dataTitle}</h2>
            <p className="text-text-muted">{copy.dataBody}</p>
          </section>
          <section>
            <h2 className="mb-1 font-semibold">{copy.infraTitle}</h2>
            <p className="text-text-muted">{copy.infraBody}</p>
          </section>
          <section>
            <h2 className="mb-1 font-semibold">{copy.logsTitle}</h2>
            <p className="text-text-muted">{copy.logsBody}</p>
          </section>
          <section>
            <h2 className="mb-1 font-semibold">{copy.deleteTitle}</h2>
            <p className="text-text-muted">{copy.deleteBody}</p>
          </section>
          <p className="text-text-muted">{copy.contact}</p>
        </div>
        <Link
          to={home}
          className="mt-8 inline-block text-sm text-accent-teal hover:underline"
        >
          {homeLabel}
        </Link>
      </article>
    </div>
  );
}
