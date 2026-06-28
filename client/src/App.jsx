import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function App() {

  const [user, setUser] = useState(null);
 
  return (
    <div>
      <main>
        <Outlet 
        context={{
          user,
          setUser,
        }}
        />
      </main>
    </div>
  );
}