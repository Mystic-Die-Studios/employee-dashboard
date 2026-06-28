import { useOutletContext } from 'react-router-dom';




export default function AuthPage() {

  const { setUser } = useOutletContext();
  
  const handleLogin = () => {
    setUser({
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
    });
  }
  return (
    <>
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <h1>Please login to GitHub to continue</h1>
            <button className="bg-blue-500 text-white p-2 rounded-md" onClick={handleLogin}>
                Login with GitHub
            </button>
        </div>
    </>
  )
}