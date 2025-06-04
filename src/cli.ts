#!/usr/bin/env node

import { Command } from 'commander';
import { 
  createIndexCommand, 
  createSearchCommand, 
  createStatsCommand, 
  createClearCommand 
} from './cli/index.js';

const program = new Command();

program
  .name('marshal-indexer')
  .description('Marshal Context Engine - AI-powered codebase indexing and search')
  .version('2.0.0');

// Add all commands
program.addCommand(createIndexCommand());
program.addCommand(createSearchCommand());
program.addCommand(createStatsCommand());
program.addCommand(createClearCommand());

program.parse();
