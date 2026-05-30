import { useAuth } from "../hooks/useAuth";

const Navbar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex items-center justify-between bg-white px-6 py-3 shadow">
      <h1 className="text-xl font-semibold text-green-700">EcoChain</h1>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
      >
        Logout
      </button>
    </div>
  );
};

export default Navbar;
