import { DataTypes } from 'sequelize';

let TerminalSession = null;

export const initializeTerminalSessionModel = sequelize => {
  TerminalSession = sequelize.define(
    'terminal_sessions',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique session identifier',
      },
      terminal_cookie: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        comment: 'Frontend-generated session identifier',
      },
      pid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Process ID of the node-pty process',
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'connecting',
        comment: 'Session status (connecting, active, closed, failed)',
      },
      session_buffer: {
        type: DataTypes.TEXT,
        comment: 'Last terminal output for reconnection',
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp when session was created',
      },
      last_accessed: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp when session was last accessed',
      },
      last_activity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'Last time session had activity (input/output)',
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
      comment: 'Terminal sessions for web-based terminal access',
    }
  );

  return TerminalSession;
};

export const getTerminalSessionModel = () => {
  if (!TerminalSession) {
    throw new Error('TerminalSession model not initialized');
  }
  return TerminalSession;
};
