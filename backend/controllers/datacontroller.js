const supabase = require("../db/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const xlsx = require("xlsx");
const fetch = require("node-fetch");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const API_KEY = "AIzaSyBqUaK5uLKOb0DXV0JjQGFPwkTeYWURXVE";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Registro de usuario
const registerUser = async (req, res) => {
  const { email, password, nombre, apellido, telefono, empresa, rol } = req.body;

  if (!email || !password || !nombre || !apellido) {
    return res.status(400).json({
      message: "Los campos email, password, nombre y apellido son requeridos.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Normalizar el rol a minúsculas
    let userRole = rol && rol.trim() !== "" ? rol.trim().toLowerCase() : "cliente";

    // Validar roles permitidos
    const validRoles = ["cliente", "tester", "master"];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({
        message: `Rol inválido. Los roles permitidos son: ${validRoles.join(", ")}.`,
      });
    }

    const { data, error } = await supabase
      .from("usuarios")
      .insert([
        {
          email,
          password_hash: hashedPassword,
          nombre,
          apellido,
          telefono,
          empresa,
          rol: userRole, // ya está en minúsculas
        },
      ])
      .select();

    if (error) return res.status(400).json({ message: error.message });

    res.status(201).json({
      message: "Usuario registrado exitosamente.",
      user: data[0],
    });
  } catch (error) {
    res.status(500).json({
      message: "Error interno del servidor.",
      error: error.message,
    });
  }
};


// Login
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Los campos email y password son requeridos." });
  }

  try {
    const { data: user, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user)
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos." });

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos." });
    }

    await supabase
      .from("usuarios")
      .update({ ultimo_login: new Date() })
      .eq("id", user.id);

    res.status(200).json({ message: "Inicio de sesión exitoso.", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error interno del servidor.", error: error.message });
  }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data)
      return res.status(404).json({ message: "Usuario no encontrado" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener usuario." });
  }
};
// Obtener todos los usuarios
const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase.from("usuarios").select("*");

    if (error) return res.status(500).json({ message: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener usuarios." });
  }
};

const actualizarEstadoProyecto = async (req, res) => {
  const proyectoId = req.params.id;
  console.log("🔍 Entrando a actualizarEstadoProyecto con proyectoId:", proyectoId);

  try {
    // 1. Traer todos los casos de prueba del proyecto
    const { data: casos, error: errorCasos } = await supabase
      .from("casos_prueba")
      .select("estado")
      .eq("proyecto_id", proyectoId);

    if (errorCasos) {
      console.error("❌ Error al consultar casos:", errorCasos.message);
      return res.status(400).json({ error: errorCasos.message });
    }

    console.log("📂 Casos encontrados:", casos);

    let nuevoEstado = "pendiente";

    if (!casos || casos.length === 0) {
      nuevoEstado = "pendiente"; // no hay casos
    } else {
      const estados = casos.map(c => c.estado);
      console.log("📊 Estados de los casos:", estados);

      if (estados.every(e => e === "finalizado")) {
        nuevoEstado = "finalizado";
      } else if (new Set(estados).size > 1 || estados.includes("proceso")) {
        nuevoEstado = "proceso";
      } else {
        nuevoEstado = estados[0];
      }
    }

    console.log("✅ Nuevo estado calculado:", nuevoEstado);

    // 2. Actualizar el proyecto en Supabase
    const { data: proyecto, error: errorUpdate } = await supabase
      .from("proyectos")
      .update({ estado: nuevoEstado })
      .eq("id", proyectoId)
      .select();

    if (errorUpdate) {
      console.error("❌ Error al actualizar proyecto:", errorUpdate.message);
      return res.status(400).json({ error: errorUpdate.message });
    }

    console.log("📝 Proyecto actualizado:", proyecto);

    res.json({ success: true, nuevoEstado });
  } catch (error) {
    console.error("🔥 Error en actualizarEstadoProyecto:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// Crear proyecto con archivo HU

const createProyecto = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    let {
      usuario_id,
      nombre_proyecto,
      descripcion,
      url_sitio,
      url_descarga,
      tipo_aplicacion,
    } = req.body;

    if (!usuario_id || !nombre_proyecto || !descripcion) {
      return res.status(400).json({
        message: "usuario_id, nombre_proyecto y descripcion son obligatorios.",
      });
    }

    if (tipo_aplicacion && typeof tipo_aplicacion === "string") {
      try {
        // intentar parsear si viene como JSON string (ej: '["Web","Móvil"]')
        tipo_aplicacion = JSON.parse(tipo_aplicacion);
      } catch {
        // si no es JSON válido, lo metemos como array con un solo valor
        tipo_aplicacion = [tipo_aplicacion];
      }
    }

    // Archivo HU subido
    let archivo_hu = null;
    if (req.file) {
      archivo_hu = path.join("documents", req.file.filename);
    }

    // Insertar proyecto
    const { data, error } = await supabase
      .from("proyectos")
      .insert([
        {
          usuario_id,
          nombre_proyecto,
          descripcion,
          url_sitio,
          url_descarga,
          tipo_aplicacion,
          archivo_hu, // ruta relativa
        },
      ])
      .select();

    if (error) return res.status(400).json({ message: error.message });

    // ✅ Ahora renombrar el archivo con (usuario_id, id_proyecto, nombre_proyecto)
    if (req.file && data && data[0]) {
      const proyectoId = data[0].id;
      const ext = path.extname(req.file.filename);
      const baseName = path.basename(req.file.filename, ext);
      const safeName = nombre_proyecto.replace(/\s+/g, "_");

      const newFileName = `${baseName}_(${usuario_id}_${proyectoId}_${safeName})${ext}`;
      const oldPath = path.join(__dirname, "../documents", req.file.filename);
      const newPath = path.join(__dirname, "../documents", newFileName);

      fs.renameSync(oldPath, newPath);

      // Actualizar en la BD con el nuevo nombre
      await supabase
        .from("proyectos")
        .update({ archivo_hu: path.join("documents", newFileName) })
        .eq("id", proyectoId);

      data[0].archivo_hu = path.join("documents", newFileName);
    }

    res
      .status(201)
      .json({ message: "Proyecto creado exitosamente.", proyecto: data[0] });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al crear proyecto.", error: err.message });
  }
};

// Obtener proyectos de un usuario
const getProyectosByUsuario = async (req, res) => {
  const { usuario_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("proyectos")
      .select("*")
      .eq("usuario_id", usuario_id);

    if (error) return res.status(400).json({ message: error.message });

    // ✅ Devolver siempre la ruta completa
    const proyectos = data.map((proyecto) => ({
      ...proyecto,
      archivo_hu_url: proyecto.archivo_hu
        ? path.join(__dirname, "..", proyecto.archivo_hu)
        : null,
    }));

    res.json(proyectos);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al obtener proyectos.", error: err.message });
  }
};

// Obtener todos los proyectos
const getAllProyectos = async (req, res) => {
  try {
    const { data, error } = await supabase.from("proyectos").select(`
    id,
    nombre_proyecto,
    descripcion,
    estado,
    archivo_hu,
    usuario_id,
    asignado_a,
    usuarios:usuario_id (id, nombre)
  `);

    if (error) {
      console.error("Error Supabase:", error);
      return res.status(400).json({ message: error.message });
    }

    res.status(200).json(data || []);
  } catch (err) {
    console.error("Error inesperado:", err);
    res.status(500).json({
      message: "Error al obtener proyectos.",
      error: err.message,
    });
  }
};

// Obtener un caso de prueba por ID
const getCasoById = async (req, res) => {
  const { id } = req.params;

  try {
    // consulta en Supabase
    const { data, error } = await supabase
      .from("casos_prueba")
      .select(
        `
        id,
        proyecto_id,
        descripcion,
        pasos,
        resultado_esperado,
        estado,
        fecha_creacion
      `
      )
      .eq("id", id)
      .single(); // solo un resultado

    if (error) {
      console.error("Error en Supabase:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ message: "Caso no encontrado" });
    }

    return res.json(data);
  } catch (err) {
    console.error("Error en servidor:", err.message);
    return res.status(500).json({ error: "Error en servidor" });
  }
};

const getProyectoById = async (req, res) => {
  try {
    const { id } = req.params; // se obtiene de la URL: /proyectos/:id

    const { data, error } = await supabase
      .from("proyectos")
      .select(
        `
        nombre_proyecto,
        url_sitio,
        url_descarga,
        tipo_aplicacion
      `
      )
      .eq("id", id)
      .single(); // trae un solo registro

    if (error) {
      console.error("Error Supabase:", error);
      return res.status(400).json({ message: error.message });
    }

    res.status(200).json(data || {});
  } catch (err) {
    console.error("Error inesperado:", err);
    res.status(500).json({
      message: "Error al obtener proyecto por ID.",
      error: err.message,
    });
  }
};

// Descargar archivo HU por id de proyecto
const downloadArchivoHU = async (req, res) => {
  try {
    const { proyecto_id } = req.params;

    // 1. Buscar proyecto en la BD
    const { data, error } = await supabase
      .from("proyectos")
      .select("archivo_hu, nombre_proyecto")
      .eq("id", proyecto_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    if (!data.archivo_hu) {
      return res
        .status(404)
        .json({ message: "El proyecto no tiene archivo HU" });
    }

    // 2. Construir la ruta absoluta del archivo
    const filePath = path.join(__dirname, "..", data.archivo_hu);

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "Archivo no encontrado en servidor" });
    }

    // 3. Forzar la descarga con nombre descriptivo
    return res.download(
      filePath,
      `HU_${data.nombre_proyecto}${path.extname(filePath)}`
    );
  } catch (err) {
    console.error("Error al descargar archivo HU:", err);
    res.status(500).json({ message: "Error interno al descargar archivo" });
  }
};
const asignarProyecto = async (req, res) => {
  const { proyecto_id, usuario_id } = req.body;

  try {
    const { data, error } = await supabase
      .from("proyectos")
      .update({ asignado_a: usuario_id })
      .eq("id", proyecto_id)
      .select();

    if (error) return res.status(400).json({ message: error.message });

    res.json({
      message: "Proyecto asignado correctamente",
      proyecto: data[0],
    });
  } catch (err) {
    res.status(500).json({
      message: "Error al asignar proyecto",
      error: err.message,
    });
  }
};

const validarCasosProyecto = async (req, res) => {
  const { proyecto_id } = req.params;

  console.log("🔍 Validando casos de uso para el proyecto:", proyecto_id);

  try {
    // Consulta a supabase
    const { data, error } = await supabase
      .from("casos_prueba")
      .select("id, estado") // le añadí estado para debug
      .eq("proyecto_id", proyecto_id);

    console.log("📤 Respuesta de Supabase:");
    console.log("   ➡️ data:", data);
    console.log("   ➡️ error:", error);

    // Manejo de error de supabase
    if (error) {
      console.error("❌ Error en la consulta Supabase:", error.message);
      return res.status(400).json({ message: error.message });
    }

    // Validación si existen casos
    if (data && data.length > 0) {
      console.log(`✅ El proyecto ${proyecto_id} tiene ${data.length} casos.`);
      return res.json({
        existe: true,
        cantidad: data.length,
        message: `El proyecto ${proyecto_id} ya tiene casos de uso.`,
        casos: data, // lo devuelvo para debug
      });
    } else {
      console.log(`⚠️ El proyecto ${proyecto_id} no tiene casos.`);
      return res.json({
        existe: false,
        cantidad: 0,
        message: `El proyecto ${proyecto_id} no tiene casos de uso.`,
      });
    }
  } catch (err) {
    console.error("🔥 Error inesperado en validarCasosProyecto:", err.message);
    res.status(500).json({
      message: "Error al validar los casos de uso del proyecto.",
      error: err.message,
    });
  }
};
const generarCasosPrueba = async (req, res) => {
  try {
    const { proyecto_id } = req.params;
    console.log("🔎 Proyecto recibido:", proyecto_id);

    // 1. Buscar el proyecto
    const { data: proyecto, error: errorProyecto } = await supabase
      .from("proyectos")
      .select("id, archivo_hu, nombre_proyecto")
      .eq("id", proyecto_id)
      .single();

    if (errorProyecto || !proyecto) {
      console.error("❌ Proyecto no encontrado:", errorProyecto);
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    console.log("✅ Proyecto encontrado:", proyecto);

    if (!proyecto.archivo_hu) {
      console.error("❌ Proyecto sin archivo HU");
      return res
        .status(404)
        .json({ message: "El proyecto no tiene archivo HU" });
    }

    const filePath = path.join(__dirname, "..", proyecto.archivo_hu);
    console.log("📂 Ruta archivo HU:", filePath);

    if (!fs.existsSync(filePath)) {
      console.error("❌ Archivo HU no existe:", filePath);
      return res
        .status(404)
        .json({ message: "Archivo HU no encontrado en servidor" });
    }

    // 2. Leer Excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const huData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log("📊 Datos leídos del Excel:", huData);

    if (huData.length === 0) {
      console.error("❌ Archivo HU vacío");
      return res.status(400).json({ message: "El archivo HU está vacío" });
    }

    // 3. Improved Prompt for Gemini
    const prompt = `
Tengo estas Historias de Usuario (HU) de un proyecto de software: 
${JSON.stringify(huData, null, 2)}

Genera casos de prueba en JSON válido con esta estructura estricta:
[
  {
    "descripcion": "texto",
    "pasos": ["paso 1", "paso 2", "paso 3"],
    "resultado_esperado": "texto",
    "estado": "pendiente"
  }
]

IMPORTANTE:
- Devuelve SOLO el array JSON, sin explicaciones ni texto adicional
- NO uses comas finales (trailing commas) en arrays u objetos
- Asegúrate de que el JSON sea válido y parseable
- No incluyas \`\`\`json ni \`\`\` en tu respuesta
`;

    console.log("📝 Prompt enviado a Gemini:\n", prompt);

    // 4. Llamar a Gemini
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    const result = await response.json();
    console.log(
      "📩 Respuesta cruda de Gemini:",
      JSON.stringify(result, null, 2)
    );

    // 5. Enhanced JSON extraction and cleaning
    let casosPrueba = [];
    if (
      result.candidates &&
      result.candidates[0].content &&
      result.candidates[0].content.parts
    ) {
      let rawText = result.candidates[0].content.parts[0].text;
      console.log("📜 Texto recibido de Gemini:", rawText);

      // Enhanced JSON cleaning function
      function cleanJSONString(text) {
        return text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim()
          // Remove trailing commas before closing brackets/braces
          .replace(/,\s*]/g, ']')
          .replace(/,\s*}/g, '}')
          // Remove any control characters that might interfere
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      }

      const cleanedText = cleanJSONString(rawText);
      console.log("🧹 Texto limpiado:", cleanedText);

      try {
        casosPrueba = JSON.parse(cleanedText);
        console.log("✅ Casos parseados:", casosPrueba);
      } catch (err) {
        console.error("❌ Error parseando JSON:", err);
        console.error("📄 Texto que falló:", cleanedText);
        
        // Additional attempt: try to fix common JSON issues
        try {
          let fixedText = cleanedText
            // Fix unclosed strings or arrays
            .replace(/"\s*,\s*$/, '"')
            // Ensure proper array/object closure
            .replace(/,\s*$/, '');
          
          // If it doesn't start with [ or {, wrap in array
          if (!fixedText.startsWith('[') && !fixedText.startsWith('{')) {
            fixedText = '[' + fixedText + ']';
          }
          
          casosPrueba = JSON.parse(fixedText);
          console.log("✅ Casos parseados después de segundo intento:", casosPrueba);
        } catch (secondErr) {
          console.error("❌ Error en segundo intento:", secondErr);
          return res.status(500).json({
            message: "Respuesta de Gemini no es JSON válido después de limpieza",
            rawText: cleanedText,
            originalError: err.message,
            secondError: secondErr.message
          });
        }
      }
    }

    if (!Array.isArray(casosPrueba) || casosPrueba.length === 0) {
      console.error("⚠️ Gemini no generó casos de prueba válidos");
      return res
        .status(400)
        .json({ message: "Gemini no generó casos de prueba válidos" });
    }

    // 6. Validate structure and insert in Supabase
    const insertData = casosPrueba
      .filter(caso => caso.descripcion && caso.pasos && caso.resultado_esperado)
      .map((c) => ({
        proyecto_id: proyecto.id,
        descripcion: c.descripcion,
        pasos: Array.isArray(c.pasos) ? c.pasos.join("\n") : String(c.pasos),
        resultado_esperado: c.resultado_esperado,
        estado: c.estado || "pendiente",
      }));

    if (insertData.length === 0) {
      console.error("⚠️ No se encontraron casos de prueba válidos para insertar");
      return res.status(400).json({ 
        message: "No se encontraron casos de prueba con estructura válida",
        receivedCases: casosPrueba 
      });
    }

    console.log("📥 Data lista para insertar:", insertData);

    const { data: inserted, error: insertError } = await supabase
      .from("casos_prueba")
      .insert(insertData)
      .select();

    if (insertError) {
      console.error("❌ Error insertando en DB:", insertError);
      return res.status(400).json({ message: insertError.message });
    }

    console.log("✅ Casos insertados en DB:", inserted);

    res.status(201).json({
      message: "✅ Casos de prueba generados e insertados con éxito",
      casos: inserted,
      total_generados: casosPrueba.length,
      total_insertados: inserted.length
    });
  } catch (err) {
    console.error("💥 Error general en generarCasosPrueba:", err);
    res.status(500).json({ message: "Error interno", error: err.message });
  }
};

// Obtener casos de prueba por historia
const getCasosByProyecto = async (req, res) => {
  const { proyecto_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("casos_prueba")
      .select("*")
      .eq("proyecto_id", proyecto_id);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error al obtener casos de prueba por proyecto.",
        error: err.message,
      });
  }
};

// Configuración de almacenamiento para archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../documents/img/");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ====================== CONTROLADORES ======================

//  Crear ejecución
const crearEjecucion = async (req, res) => {
  try {
    const { caso_id, tester_id, resultado, comentarios } = req.body;

    const { data, error } = await supabase
      .from("ejecuciones")
      .insert([{ caso_id, tester_id, resultado, comentarios }])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Ejecución creada con éxito",
      ejecucion: data[0],
    });
  } catch (err) {
    console.error("Error al crear ejecución:", err);
    res.status(500).json({ error: err.message });
  }
};

//  Obtener ejecuciones por caso_id
const obtenerEjecucionesPorCaso = async (req, res) => {
  try {
    const { casoId } = req.params;

    const { data, error } = await supabase
      .from("ejecuciones")
      .select("*, usuarios(nombre)")
      .eq("caso_id", casoId);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error al obtener ejecuciones:", err);
    res.status(500).json({ error: err.message });
  }
};

//  Subir evidencia
const subirEvidencia = async (req, res) => {
  try {
    const { ejecucion_id, tipo } = req.body;
    const archivo = req.file;

    if (!archivo) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    // Obtener extensión original (.png, .jpg, .pdf, etc.)
    const extension = path.extname(archivo.originalname);

    // Crear nombre único (ej: evidencia_21_1693334449999.png)
    const nuevoNombre = `evidencia_${ejecucion_id}_${Date.now()}${extension}`;

    // Ruta de destino
    const destino = path.join("documents/img", nuevoNombre);

    // Mover archivo temporal a carpeta final
    fs.renameSync(archivo.path, destino);

    // Guardar solo la ruta relativa para servirla en frontend
    const archivo_url = `documents/img/${nuevoNombre}`;

    // Insertar en base de datos
    const { data, error } = await supabase
      .from("evidencias")
      .insert([{ ejecucion_id, archivo_url, tipo }])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Evidencia subida con éxito",
      evidencia: data[0],
    });
  } catch (err) {
    console.error("Error al subir evidencia:", err);
    res.status(500).json({ error: err.message });
  }
};

const obtenerEvidenciasPorEjecucion = async (req, res) => {
  try {
    const { ejecucionId } = req.params;
    console.log("📌 Param ejecucionId:", ejecucionId); // Debug

    if (!ejecucionId) {
      return res.status(400).json({ error: "Falta ejecucionId en la ruta" });
    }

    const { data, error } = await supabase
      .from("evidencias")
      .select("*")
      .eq("ejecucion_id", parseInt(ejecucionId)); // asegurar número

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error al obtener evidencias:", err);
    res.status(500).json({ error: err.message });
  }
};

//  Actualizar estado de un caso de prueba
const updateCasoPruebaEstado = async (req, res) => {
  try {
    const { casoId } = req.params; // ID desde la URL
    const { estado } = req.body; // Nuevo estado desde el body

    if (!estado) {
      return res
        .status(400)
        .json({ message: "El campo 'estado' es obligatorio." });
    }

    const { data, error } = await supabase
      .from("casos_prueba") // 👈 nombre correcto de la tabla
      .update({ estado })
      .eq("id", casoId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Caso de prueba no encontrado." });
    }

    res.json({
      message: "Estado actualizado exitosamente ✅",
      caso: data[0],
    });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ error: err.message });
  }
};

// Obtener ejecuciones por caso
const getEjecucionesByCaso = async (req, res) => {
  const { caso_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("ejecuciones")
      .select("*")
      .eq("caso_id", caso_id);

    if (error) return res.status(400).json({ message: error.message });

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al obtener ejecuciones.", error: err.message });
  }
};
// Subir evidencia
const createEvidencia = async (req, res) => {
  const { ejecucion_id, tipo, url } = req.body;

  try {
    const { data, error } = await supabase
      .from("evidencias")
      .insert([{ ejecucion_id, tipo, url }])
      .select();

    if (error) return res.status(400).json({ message: error.message });

    res.status(201).json({ message: "Evidencia subida.", evidencia: data[0] });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al subir evidencia.", error: err.message });
  }
};

// Obtener evidencias por ejecución
const getEvidenciasByEjecucion = async (req, res) => {
  const { ejecucion_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("evidencias")
      .select("*")
      .eq("ejecucion_id", ejecucion_id);

    if (error) return res.status(400).json({ message: error.message });

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al obtener evidencias.", error: err.message });
  }
};


module.exports = {
  
  registerUser,
  loginUser,
  getUserById,
  createProyecto,
  getProyectosByUsuario,
  asignarProyecto,
  getCasosByProyecto,
  getEjecucionesByCaso,
  createEvidencia,
  getEvidenciasByEjecucion,
  getAllProyectos,
  downloadArchivoHU,
  generarCasosPrueba,
  validarCasosProyecto,
  getCasoById,
  getProyectoById,
actualizarEstadoProyecto,
  updateCasoPruebaEstado,
  crearEjecucion,
  getUsers,
  subirEvidencia,
  obtenerEjecucionesPorCaso,
  obtenerEvidenciasPorEjecucion,
};
