import { Outlet } from 'react-router-dom';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';

export function MobileLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MobileHeader />
      
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      
      <BottomNav />
    </div>
  );
}
