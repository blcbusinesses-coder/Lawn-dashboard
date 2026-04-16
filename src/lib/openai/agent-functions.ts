import type OpenAI from 'openai'

export const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // ── READ TOOLS ────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'query_customers',
      description: 'Fetch customer list with optional name/email filter',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional name or email search term' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_jobs',
      description: 'Get job completion statistics for a date range',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
          end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
          property_address: { type: 'string', description: 'Optional property address filter' },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_expenses',
      description: 'Fetch expense records, optionally filtered by date range or category',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
          end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
          category: { type: 'string', description: 'Optional category filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_revenue',
      description: 'Get invoice revenue totals for a date range',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
          end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_properties',
      description: 'List all active properties with pricing and customer info',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional address search term' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_employee_hours',
      description: 'Get employee time log summaries and calculated pay',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
          end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
          employee_id: { type: 'string', description: 'Optional specific employee UUID' },
        },
      },
    },
  },

  // ── ACTION TOOLS ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'Create a new customer record',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string', description: 'Full name of the customer' },
          email: { type: 'string', description: 'Email address (optional)' },
          phone: { type: 'string', description: 'Phone number (optional)' },
          address: { type: 'string', description: 'Billing/mailing address (optional)' },
          notes: { type: 'string', description: 'Notes about the customer (optional)' },
        },
        required: ['full_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_customer',
      description: 'Update fields on an existing customer by their ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Customer UUID' },
          full_name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_property',
      description: 'Create a new property (lawn) linked to a customer. Use customer_name for fuzzy lookup.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Customer name (fuzzy matched — partial OK)' },
          address: { type: 'string', description: 'Full property/service address' },
          price_per_mow: { type: 'number', description: 'Price per mow in dollars (default 0)' },
          notes: { type: 'string', description: 'Notes about this property (optional)' },
        },
        required: ['customer_name', 'address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_create_properties',
      description: 'Create multiple properties at once, all linked to the same customer. Use when the user provides a list of addresses.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Customer name (fuzzy matched)' },
          properties: {
            type: 'array',
            description: 'Array of properties to create',
            items: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                price_per_mow: { type: 'number' },
                notes: { type: 'string' },
              },
              required: ['address'],
            },
          },
        },
        required: ['customer_name', 'properties'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_property',
      description: 'Update a property record by ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Property UUID' },
          address: { type: 'string' },
          price_per_mow: { type: 'number' },
          notes: { type: 'string' },
          is_active: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_job_log',
      description: 'Log a job as done or skipped for a property and week. Use "current" for week_start to mean the current week.',
      parameters: {
        type: 'object',
        properties: {
          property_address: { type: 'string', description: 'Property address (fuzzy matched)' },
          week_start: { type: 'string', description: 'Monday date YYYY-MM-DD, or "current" for this week' },
          status: { type: 'string', enum: ['done', 'skipped'], description: 'Job status' },
          notes: { type: 'string', description: 'Optional notes' },
        },
        required: ['property_address', 'week_start', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_expense',
      description: 'Create a new expense record',
      parameters: {
        type: 'object',
        properties: {
          merchant: { type: 'string', description: 'Merchant or vendor name' },
          amount: { type: 'number', description: 'Amount in dollars' },
          category: { type: 'string', description: 'Category (e.g. fuel, equipment, supplies)' },
          expense_date: { type: 'string', description: 'Date of expense YYYY-MM-DD' },
          notes: { type: 'string', description: 'Optional notes' },
        },
        required: ['merchant', 'amount', 'expense_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_sms',
      description: 'Send an SMS text message to a customer by name',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Customer name (fuzzy matched)' },
          body: { type: 'string', description: 'Message text to send' },
        },
        required: ['customer_name', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_monthly_invoices',
      description: 'Generate draft invoices for all customers for a given month based on completed jobs',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'Year (e.g. 2025)' },
          month: { type: 'number', description: 'Month number 1-12' },
        },
        required: ['year', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_scheduled_task',
      description: 'Create a scheduled task or reminder',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description (optional)' },
          trigger_type: {
            type: 'string',
            enum: ['once', 'monthly', 'weekly', 'reminder'],
            description: 'How this task recurs',
          },
          trigger_date: { type: 'string', description: 'Date YYYY-MM-DD when task should trigger (optional)' },
          action_type: { type: 'string', description: 'Machine-readable action type (optional)' },
          action_params: { type: 'object', description: 'Parameters for the action (optional)' },
        },
        required: ['title', 'trigger_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_scheduled_tasks',
      description: 'List scheduled tasks, optionally filtered by status',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'done', 'cancelled'],
            description: 'Filter by status (default: pending)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_scheduled_task',
      description: 'Mark a scheduled task as done or cancelled',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task UUID' },
          status: { type: 'string', enum: ['done', 'cancelled'], description: 'New status' },
        },
        required: ['id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_one_off_job',
      description: 'Create a one-off job (e.g. mulching, stick cleanup, leaf removal) for a customer. These are ad-hoc services outside the regular mowing schedule.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Service name, e.g. "Mulching", "Stick Cleanup"' },
          description: { type: 'string', description: 'Optional details about the job' },
          customer_name: { type: 'string', description: 'Customer name (fuzzy matched — optional)' },
          amount: { type: 'number', description: 'Price for this job in dollars' },
          scheduled_date: { type: 'string', description: 'Planned date YYYY-MM-DD (optional)' },
          notes: { type: 'string', description: 'Optional notes' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_one_off_jobs',
      description: 'List one-off jobs, optionally filtered by status',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'done', 'cancelled'], description: 'Filter by status (omit for all)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_one_off_job',
      description: 'Mark a one-off job as done by its ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'One-off job UUID' },
          completed_date: { type: 'string', description: 'Completion date YYYY-MM-DD (defaults to today)' },
        },
        required: ['id'],
      },
    },
  },
]
