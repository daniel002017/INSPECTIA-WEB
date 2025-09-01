const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  // Usuarios
  registerUser,
  loginUser,
  getUserById,
  // Proyectos
  getProyectoById,
  createProyecto,
  getProyectosByUsuario,
  getAllProyectos,
  downloadArchivoHU,
  updateCasoPruebaEstado,
  asignarProyecto,
  getCasosByProyecto,
  actualizarEstadoProyecto,
  // Casos de prueba
  generarCasosPrueba,
  getCasoById,
  validarCasosProyecto,
  // Evidencias
  createEvidencia,
  getEvidenciasByEjecucion,
 getUsers,
  crearEjecucion,
  subirEvidencia,
  obtenerEjecucionesPorCaso,
  obtenerEvidenciasPorEjecucion,

} = require("../controllers/datacontroller");

/**
 * @swagger
 * /ejecuciones:
 *   post:
 *     summary: Crear una nueva ejecución de caso de prueba
 *     tags: [Ejecuciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Ejecución creada exitosamente
 */
router.post("/ejecuciones", crearEjecucion);

/**
 * @swagger
 * /ejecuciones/{casoId}:
 *   get:
 *     summary: Obtener ejecuciones por caso de prueba
 *     tags: [Ejecuciones]
 *     parameters:
 *       - in: path
 *         name: casoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de ejecuciones
 */
router.get("/ejecuciones/:casoId", obtenerEjecucionesPorCaso);

/**
 * @swagger
 * /casos/{casoId}/estado:
 *   put:
 *     summary: Actualizar el estado de un caso de prueba
 *     tags: [Casos de Prueba]
 *     parameters:
 *       - in: path
 *         name: casoId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado:
 *                 type: string
 *                 example: "aprobado"
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.put("/casos/:casoId/estado", updateCasoPruebaEstado);

/**
 * @swagger
 * /evidencias:
 *   post:
 *     summary: Subir una evidencia de ejecución
 *     tags: [Evidencias]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *               descripcion:
 *                 type: string
 *                 example: "Captura de pantalla del error"
 *               ejecucion_id:
 *                 type: string
 *                 example: "64c3d4e5f6a7b8c9d0e1f2a3"
 *     responses:
 *       201:
 *         description: Evidencia subida exitosamente
 */
router.post("/evidencias", upload.single("archivo"), subirEvidencia);

/**
 * @swagger
 * /evidencias/{ejecucionId}:
 *   get:
 *     summary: Obtener evidencias por ejecución
 *     tags: [Evidencias]
 *     parameters:
 *       - in: path
 *         name: ejecucionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de evidencias
 */
router.get("/evidencias/:ejecucionId", obtenerEvidenciasPorEjecucion);
/* ---------------------- USUARIOS ---------------------- */
// Autenticación
/**
 * @swagger
 * /register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password_hash
 *               - nombre
 *               - apellido
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan.perez@email.com
 *               password:
 *                 type: string
 *                 description: Contraseña encriptada (hash)
 *                 example: $2b$10$O2kQ2Vx3mPl9hK09x8m7Eex9A0LfZrYIhDkZ7tSx9fZJzZtQhYh1m
 *               nombre:
 *                 type: string
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Pérez
 *               telefono:
 *                 type: string
 *                 nullable: true
 *                 example: "+573001112233"
 *               empresa:
 *                 type: string
 *                 nullable: true
 *                 example: "Tech Solutions"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Datos inválidos o incompletos
 */

router.post("/register", registerUser);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Iniciar sesión de usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan.perez@email.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Usuario autenticado
 */
router.post("/login", loginUser);

// CRUD usuarios
/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario encontrado
 */
router.get("/users/:id", getUserById);

/* ---------------------- PROYECTOS ---------------------- */
/**
 * @swagger
 * /create:
 *   post:
 *     summary: Crear un nuevo proyecto
 *     tags: [Proyectos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Proyecto Inspección
 *               descripcion:
 *                 type: string
 *                 example: Proyecto para pruebas de inspección
 *               archivo_hu:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Proyecto creado exitosamente
 */
router.post("/create", upload.single("archivo_hu"), createProyecto);

/**
 * @swagger
 * /proyectos/{usuario_id}:
 *   get:
 *     summary: Obtener proyectos por usuario
 *     tags: [Proyectos]
 *     parameters:
 *       - in: path
 *         name: usuario_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de proyectos
 */
router.get("/proyectos/:usuario_id", getProyectosByUsuario);
// Obtener todos los proyectos
/**
 * @swagger
 * /proyectos:
 *   get:
 *     summary: Obtener todos los proyectos
 *     tags: [Proyectos]
 *     responses:
 *       200:
 *         description: Lista de todos los proyectos
 */
router.get("/proyectos", getAllProyectos);

/**
 * @swagger
 * /proyectos/{proyecto_id}/hu:
 *   get:
 *     summary: Descargar archivo HU de un proyecto
 *     tags: [Proyectos]
 *     parameters:
 *       - in: path
 *         name: proyecto_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Archivo HU descargado
 */
router.get("/proyectos/:proyecto_id/hu", downloadArchivoHU);

/**
 * @swagger
 * /proyectos/{proyecto_id}/generar-casos:
 *   post:
 *     summary: Generar casos de prueba para un proyecto
 *     tags: [Proyectos]
 *     parameters:
 *       - in: path
 *         name: proyecto_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Casos de prueba generados
 */
router.post("/proyectos/:proyecto_id/generar-casos", generarCasosPrueba);

/**
 * @swagger
 * /proyecto/{id}:
 *   get:
 *     summary: Obtener proyecto por ID
 *     tags: [Proyectos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proyecto encontrado
 */
router.get("/proyecto/:id", getProyectoById);

/**
 * @swagger
 * /asignarProyecto:
 *   post:
 *     summary: Asignar un proyecto a un usuario
 *     tags: [Proyectos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario_id:
 *                 type: string
 *                 example: "64a1f2c3e4b5a6d7e8f9a0b1"
 *               proyecto_id:
 *                 type: string
 *                 example: "64b2e3d4f5a6b7c8d9e0f1a2"
 *     responses:
 *       200:
 *         description: Proyecto asignado
 */
router.post("/asignarProyecto", asignarProyecto);

/**
 * @swagger
 * /{proyecto_id}/validar-casos:
 *   get:
 *     summary: Validar casos de prueba de un proyecto
 *     tags: [Proyectos]
 *     parameters:
 *       - in: path
 *         name: proyecto_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Casos validados
 */
router.get("/:proyecto_id/validar-casos", validarCasosProyecto);
/* ------------------- CASOS DE PRUEBA ------------------- */
/**
 * @swagger
 * /casos/{id}:
 *   get:
 *     summary: Obtener caso de prueba por ID
 *     tags: [Casos de Prueba]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Caso de prueba encontrado
 */
router.get("/casos/:id", getCasoById);

/**
 * @swagger
 * /proyectos/{proyecto_id}/casos:
 *   get:
 *     summary: Obtener casos de prueba por proyecto
 *     tags: [Casos de Prueba]
 *     parameters:
 *       - in: path
 *         name: proyecto_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de casos de prueba
 */
router.get("/proyectos/:proyecto_id/casos", getCasosByProyecto);

/* -------------------- EJECUCIONES ---------------------- */

/* --------------------- EVIDENCIAS ---------------------- */
/**
 * @swagger
 * /evidencias:
 *   post:
 *     summary: Crear una evidencia
 *     tags: [Evidencias]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               descripcion:
 *                 type: string
 *                 example: "Evidencia de ejecución exitosa"
 *               ejecucion_id:
 *                 type: string
 *                 example: "64c3d4e5f6a7b8c9d0e1f2a3"
 *     responses:
 *       201:
 *         description: Evidencia creada exitosamente
 */
router.post("/evidencias", createEvidencia);

/**
 * @swagger
 * /evidencias/{ejecucion_id}:
 *   get:
 *     summary: Obtener evidencias por ejecución
 *     tags: [Evidencias]
 *     parameters:
 *       - in: path
 *         name: ejecucion_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de evidencias
 */
router.get("/evidencias/:ejecucion_id", getEvidenciasByEjecucion);
router.get("/users", getUsers);
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
router.get("/users", getUsers);

/**
 * @swagger
 * /{id}/estado:
 *   put:
 *     summary: Actualizar el estado de un proyecto
 *     tags: [Proyectos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado:
 *                 type: string
 *                 example: "En progreso"
 *     responses:
 *       200:
 *         description: Estado del proyecto actualizado
 */
router.put("/:id/estado", (req, res, next) => {
  console.log("👉 Llegó petición PUT a /proyectos/:id/estado");
  console.log("Params:", req.params);
  next(); // pasa al controlador
}, actualizarEstadoProyecto);


module.exports = router;
