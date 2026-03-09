import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Palette, Square, LayoutGrid, Volume2, VolumeX, MessageCircle, Check, User } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import {
  useSettingsStore,
  CardStyle, TableStyle, AppTheme,
  CARD_STYLES, TABLE_STYLES, APP_THEMES, AVATAR_OPTIONS,
} from '@/store/settingsStore';
import PageTransition from '@/components/PageTransition';
import { toast } from 'sonner';

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <h2 className="text-lg font-arabic font-bold text-foreground">{title}</h2>
    </div>
  );
}

function CardPreview({ style, active, onClick }: { style: CardStyle; active: boolean; onClick: () => void }) {
  const cfg = CARD_STYLES[style];
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        active ? 'border-primary gold-glow bg-secondary' : 'border-border bg-secondary/40 hover:border-primary/30'
      }`}
    >
      <div className="w-10 h-20 rounded-md border flex flex-col overflow-hidden" style={{
        background: `linear-gradient(145deg, hsl(${cfg.tileFace}), hsl(${cfg.tileFace} / 0.85))`,
        borderColor: `hsl(${cfg.tileDivider})`,
      }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full" style={{ background: `hsl(${cfg.tileDot})` }} />
        </div>
        <div className="h-[2px] mx-1 rounded-full" style={{ background: `hsl(${cfg.tileDivider})` }} />
        <div className="flex-1 flex items-center justify-center gap-[2px]">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${cfg.tileDot})` }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${cfg.tileDot})` }} />
        </div>
      </div>
      <span className="text-[10px] font-arabic font-semibold text-foreground leading-tight">{cfg.labelAr}</span>
      {active && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[10px] font-bold">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
}

function TablePreview({ style, active, onClick }: { style: TableStyle; active: boolean; onClick: () => void }) {
  const cfg = TABLE_STYLES[style];
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        active ? 'border-primary gold-glow bg-secondary' : 'border-border bg-secondary/40 hover:border-primary/30'
      }`}
    >
      <div
        className="w-14 h-10 rounded-lg border-2"
        style={{
          background: cfg.gradient,
          borderColor: `hsl(${cfg.feltBorder})`,
        }}
      />
      <span className="text-[10px] font-arabic font-semibold text-foreground leading-tight">{cfg.labelAr}</span>
      {active && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[10px] font-bold">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
}

function ThemePreview({ theme, active, onClick }: { theme: AppTheme; active: boolean; onClick: () => void }) {
  const cfg = APP_THEMES[theme];
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        active ? 'border-primary gold-glow bg-secondary' : 'border-border bg-secondary/40 hover:border-primary/30'
      }`}
    >
      <div className="w-14 h-10 rounded-lg overflow-hidden flex flex-col">
        <div className="flex-1 relative" style={{ background: `hsl(${cfg.background})` }}>
          <div className="flex items-center justify-center h-full gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: `hsl(${cfg.primary})` }} />
            <div className="w-4 h-0.5 rounded" style={{ background: `hsl(${cfg.foreground} / 0.4)` }} />
          </div>
        </div>
        <div className="h-2.5 flex gap-[1px]">
          <div className="flex-1" style={{ background: `hsl(${cfg.primary})` }} />
          <div className="flex-1" style={{ background: `hsl(${cfg.goldWarm})` }} />
          <div className="flex-1" style={{ background: `hsl(${cfg.secondary})` }} />
        </div>
      </div>
      <span className="text-[10px] font-arabic font-semibold text-foreground leading-tight">{cfg.labelAr}</span>
      {active && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[10px] font-bold">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
}


export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    cardStyle, tableStyle, appTheme, soundEnabled, chatEnabled, playerName, playerAvatar,
    setCardStyle, setTableStyle, setAppTheme, setSoundEnabled, setChatEnabled, setPlayerName, setPlayerAvatar,
  } = useSettingsStore();

  const handleSave = () => {
    toast.success('تم حفظ الإعدادات بنجاح ✓');
    navigate('/home');
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex flex-col items-center p-4 overflow-y-auto relative" dir="rtl">
        {/* Header */}
        <motion.div
          className="w-full max-w-lg flex items-center gap-3 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.button
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowRight className="w-5 h-5" />
          </motion.button>
          <h1 className="text-2xl font-bold gold-text font-arabic flex-1">الإعدادات</h1>
        </motion.div>

        <div className="w-full max-w-lg flex flex-col gap-8">
          {/* Player Name */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <SectionTitle icon={<User className="w-5 h-5" />} title="اسم اللاعب" />
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="ادخل اسمك..."
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground font-arabic placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors mb-4"
            />
            <p className="text-xs font-arabic text-muted-foreground mb-2">اختر أفاتار</p>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_OPTIONS.map((avatar) => (
                <motion.button
                  key={avatar}
                  onClick={() => setPlayerAvatar(avatar)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className={`relative w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all min-w-[44px] min-h-[44px] ${
                    playerAvatar === avatar
                      ? 'border-2 border-primary bg-primary/15 gold-glow'
                      : 'border border-border bg-secondary/40 hover:border-primary/30'
                  }`}
                >
                  {avatar}
                  {playerAvatar === avatar && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-[8px] font-bold">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* App Themes */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SectionTitle icon={<Palette className="w-5 h-5" />} title="الأجواء العامة" />
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(APP_THEMES) as AppTheme[]).map((theme) => (
                <ThemePreview key={theme} theme={theme} active={appTheme === theme} onClick={() => setAppTheme(theme)} />
              ))}
            </div>
          </motion.section>

          {/* Card Styles */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SectionTitle icon={<Square className="w-5 h-5" />} title="شكل الكروت" />
            <div className="grid grid-cols-4 gap-3">
              {(Object.keys(CARD_STYLES) as CardStyle[]).map((style) => (
                <CardPreview key={style} style={style} active={cardStyle === style} onClick={() => setCardStyle(style)} />
              ))}
            </div>
          </motion.section>


          {/* Table Styles */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <SectionTitle icon={<LayoutGrid className="w-5 h-5" />} title="شكل الطاولة" />
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(TABLE_STYLES) as TableStyle[]).map((style) => (
                <TablePreview key={style} style={style} active={tableStyle === style} onClick={() => setTableStyle(style)} />
              ))}
            </div>
          </motion.section>

          {/* Toggles */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-4 py-4 bg-secondary/60 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </div>
                <span className="font-arabic font-bold text-foreground">الصوت</span>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>

            <div className="flex items-center justify-between px-4 py-4 bg-secondary/60 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-arabic font-bold text-foreground">الشات أونلاين</span>
                  <span className="text-[10px] font-arabic text-muted-foreground">إظهار/إخفاء الشات أثناء اللعب</span>
                </div>
              </div>
              <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} />
            </div>
          </motion.section>

          {/* Save Button */}
          <motion.button
            onClick={handleSave}
            className="w-full gold-gradient text-primary-foreground font-arabic font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-3 gold-glow-strong"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Check className="w-6 h-6" />
            <span>حفظ الإعدادات</span>
          </motion.button>

          <motion.p
            className="text-center text-[10px] text-muted-foreground/50 font-mono tracking-wider pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            NASHAAT GAMING © 2026
          </motion.p>
        </div>
      </div>
    </PageTransition>
  );
}
