import { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Lista de roles válidos del sistema
  const VALID_ROLES = ["ADMIN", "SUPERADMIN", "PROGRAM_HEAD", "PROGRAM_CURRICULUM_COMMITTEE", "STUDENT", "PROJECT_DIRECTOR", "EXAMINER"];

  // 🧠 Inferir rol basado en los permisos que tiene
  const inferRoleFromPermissions = (permissions) => {
    if (!permissions || permissions.length === 0) return null;

    const permissionsStr = permissions.join(",").toUpperCase();

    // ✅ PRIMERO verificar EXAMINER (ANTES que los demás)
    if (permissionsStr.includes("EVALUATE_DEFENSE") || 
        permissionsStr.includes("GRADE_DEFENSE") ||
        permissionsStr.includes("VIEW_DEFENSE_ASSIGNMENTS")) {
      return "EXAMINER";
    }

    // Si tiene permisos de director
    if (permissionsStr.includes("PROPOSE_DEFENSE") ||
        permissionsStr.includes("MANAGE_STUDENT_PROJECT")) {
      return "PROJECT_DIRECTOR";
    }

    // Si tiene permisos de ADMIN (crear roles, permisos, etc.)
    if (permissionsStr.includes("CREATE_ROLE") || 
        permissionsStr.includes("CREATE_PERMISSION") ||
        permissionsStr.includes("CREATE_MODALITY")) {
      return "ADMIN";
    }

    // Si tiene permisos de jefe programa
    if (permissionsStr.includes("REVIEW_DOCUMENTS") || 
        permissionsStr.includes("APPROVE_DOCUMENTS")) {
      return "PROGRAM_HEAD";
    }

    // Si tiene permisos de comite
    if (permissionsStr.includes("COUNCIL_REVIEW")) {
      return "PROGRAM_CURRICULUM_COMMITTEE";
    }

    // Por defecto, si no podemos inferir, asumimos STUDENT
    return "STUDENT";
  };

  // 🔹 Extrae y normaliza el rol desde el JWT
  const extractRole = (decoded) => {
    console.log("🔍 Extrayendo rol del token:", decoded);

    // 1️⃣ Intentar obtener el rol directo
    if (decoded?.role) {
      const normalizedRole = decoded.role.toUpperCase();
      if (VALID_ROLES.includes(normalizedRole)) {
        console.log("✅ Rol encontrado en campo 'role':", normalizedRole);
        return normalizedRole;
      }
    }

    // 2️⃣ Intentar obtener de authorities (puede ser array o string)
    if (decoded?.authorities) {
      let authorities = [];
      
      if (Array.isArray(decoded.authorities)) {
        authorities = decoded.authorities;
      } else if (typeof decoded.authorities === 'string') {
        authorities = decoded.authorities.split(',').map(a => a.trim());
      }
      
      console.log("📋 Authorities encontradas:", authorities);

      // Buscar un ROL válido en las authorities
      for (const auth of authorities) {
        const cleanAuth = auth.replace("ROLE_", "").trim().toUpperCase();
        if (VALID_ROLES.includes(cleanAuth)) {
          console.log("✅ Rol encontrado en authorities:", cleanAuth);
          return cleanAuth;
        }
      }

      // Si no encontramos un rol válido, pero hay authorities, 
      // intentar inferir el rol basado en permisos
      const inferredRole = inferRoleFromPermissions(authorities);
      if (inferredRole) {
        console.log("🧠 Rol inferido de permisos:", inferredRole);
        return inferredRole;
      }
    }

    // 3️⃣ Intentar obtener de authority (singular)
    if (decoded?.authority) {
      const cleanAuth = decoded.authority.replace("ROLE_", "").trim().toUpperCase();
      if (VALID_ROLES.includes(cleanAuth)) {
        console.log("✅ Rol encontrado en authority:", cleanAuth);
        return cleanAuth;
      }
    }

    console.error("❌ No se pudo extraer un rol válido del token");
    return null;
  };

  // 🔹 Extrae información del usuario desde el JWT
  const extractUserInfo = (decoded) => {
    return {
      email: decoded?.sub || decoded?.email || null,
      name: decoded?.name || null,
      userId: decoded?.userId || null,
    };
  };

  // 🔄 Restaurar sesión al recargar
  useEffect(() => {
  const restoreSession = () => { // Usamos una función interna para mayor claridad
    console.log("🔄 Inicializando AuthContext...");
    const storedToken = localStorage.getItem("token");

    if (!storedToken || storedToken === "undefined" || storedToken === "null") {
      console.log("📭 No hay token válido en localStorage");
      setLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode(storedToken);
      const extractedRole = extractRole(decoded);
      const extractedUser = extractUserInfo(decoded);

      if (extractedRole) {
        setToken(storedToken);
        setRole(extractedRole);
        setUser(extractedUser);
        console.log("✅ Sesión restaurada:", extractedRole);
      } else {
        localStorage.removeItem("token");
      }
    } catch (error) {
      console.error("❌ Error crítico en AuthContext:", error);
      localStorage.removeItem("token");
    } finally {
      // ESTA LÍNEA ES LA MÁS IMPORTANTE
      // Garantiza que la pantalla "Cargando..." del ProtectedRoute desaparezca
      setLoading(false); 
    }
  };

  restoreSession();
}, []);

  // ✅ Escuchar evento de unauthorized desde axios
  useEffect(() => {
    const handleUnauthorized = () => {
      console.log("🚨 Evento unauthorized recibido, cerrando sesión");
      logout();
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  // 🔐 Login
  const login = (newToken) => {
    console.log("🔐 Procesando login en contexto...");
    localStorage.setItem("token", newToken);
    
    try {
      const decoded = jwtDecode(newToken);
      console.log("🔍 Token decodificado en login:", decoded);
      
      const extractedRole = extractRole(decoded);
      const extractedUser = extractUserInfo(decoded);
      
      console.log("🎯 Estableciendo rol:", extractedRole);
      console.log("👤 Estableciendo usuario:", extractedUser);
      
      if (!extractedRole) {
        throw new Error("No se pudo extraer el rol del token");
      }
      
      setToken(newToken);
      setRole(extractedRole);
      setUser(extractedUser);
    } catch (error) {
      console.error("❌ Error en login:", error);
      throw error;
    }
  };

  // 🚪 Logout
  const logout = () => {
    console.log("🚪 Cerrando sesión");
    localStorage.removeItem("token");
    setToken(null);
    setRole(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        user,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);