/**
 * @typedef {Object} Department
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {Object} Question
 * @property {number} id
 * @property {number} template_id
 * @property {number} order_index
 * @property {string} text
 */

/**
 * @typedef {Object} QuestionTemplate
 * @property {number} id
 * @property {number} department_id
 * @property {string} name
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {Question[]} [questions]
 */

/**
 * @typedef {'waiting'|'answering'|'answered'|'summarised'|'done'} VisitStatus
 */

/**
 * @typedef {Object} Visit
 * @property {number} id
 * @property {number} token_number
 * @property {string} patient_name
 * @property {number} age
 * @property {string} sex
 * @property {number} department_id
 * @property {VisitStatus} status
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {'pending'|'done'|'failed'} TranscriptStatus
 */

/**
 * @typedef {Object} Answer
 * @property {number} id
 * @property {number} visit_id
 * @property {number} question_id
 * @property {string} audio_path
 * @property {string} transcript
 * @property {TranscriptStatus} transcript_status
 * @property {string} created_at
 */

/**
 * @typedef {Object} Summary
 * @property {number} id
 * @property {number} visit_id
 * @property {string} summary_text
 * @property {string} generated_by
 * @property {string} created_at
 */
