# Contributing to Fantasy Draft Pros

Thank you for your interest in contributing to Fantasy Draft Pros! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, constructive, and collaborative. We're all here to build something great for the fantasy football community.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (browser, OS, etc.)

### Suggesting Features

1. Check if the feature has been suggested
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach
   - Any relevant mockups or examples

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/fantasy-draft-pros.git
   cd fantasy-draft-pros
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the code style guidelines below
   - Write clean, readable code
   - Add comments for complex logic
   - Update tests if applicable

4. **Test your changes**
   ```bash
   npm run build
   npm run lint
   npm run typecheck
   ```

5. **Commit with clear messages**
   ```bash
   git commit -m "Add feature: brief description"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub

## Code Style Guidelines

### TypeScript/React

- Use TypeScript for all new files
- Prefer functional components with hooks
- Use meaningful variable and function names
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

### Component Structure

```typescript
import { useState, useEffect } from 'react';
import { ComponentIcon } from 'lucide-react';

interface ComponentProps {
  prop1: string;
  prop2?: number;
}

export function Component({ prop1, prop2 = 0 }: ComponentProps) {
  const [state, setState] = useState<string>('');

  useEffect(() => {
    // Effect logic
  }, []);

  const handleAction = () => {
    // Handler logic
  };

  return (
    <div className="container">
      {/* Component JSX */}
    </div>
  );
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow the existing CMG color scheme
- Use responsive design classes (sm:, md:, lg:)
- Maintain consistent spacing (4px grid system)

### Database Migrations

When adding database changes:

1. Create a new migration file in `supabase/migrations/`
2. Use descriptive filename: `YYYYMMDDHHMMSS_description.sql`
3. Include comprehensive comments explaining changes
4. Always enable RLS on new tables
5. Add appropriate policies for data access

Example:
```sql
/*
  # Add new feature table

  1. New Tables
    - `table_name`
      - Column descriptions

  2. Security
    - Enable RLS
    - Add user-specific policies
*/

CREATE TABLE IF NOT EXISTS table_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

## Project Structure

### Key Directories

```
src/
├── components/     # React components
├── hooks/         # Custom React hooks
├── services/      # API clients and services
├── lib/           # Utility functions and configs
└── types/         # TypeScript type definitions

supabase/
└── migrations/    # Database migration files

public/           # Static assets
docs/            # Additional documentation
```

### Component Organization

- Each major feature gets its own component file
- Keep components under 300 lines when possible
- Extract complex logic into service files
- Use interfaces for all props and data types

## Testing Guidelines

Before submitting:

1. **Manual Testing**
   - Test all affected features
   - Check responsive design on mobile
   - Verify in multiple browsers
   - Test error states and edge cases

2. **Build Verification**
   ```bash
   npm run build
   ```
   Ensure no TypeScript errors or build failures

3. **Linting**
   ```bash
   npm run lint
   ```
   Fix any linting errors

## API Integration

When adding new API integrations:

1. Create service file in `src/services/`
2. Handle errors gracefully
3. Add loading states
4. Cache responses when appropriate
5. Use environment variables for API keys

Example:
```typescript
export class MyAPI {
  private baseUrl = import.meta.env.VITE_API_URL;

  async fetchData(): Promise<Data[]> {
    try {
      const response = await fetch(`${this.baseUrl}/endpoint`);
      if (!response.ok) throw new Error('Failed to fetch');
      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  }
}

export const myAPI = new MyAPI();
```

## Documentation

When adding features:

1. Update README.md if it affects setup or usage
2. Add inline code comments for complex logic
3. Update TypeScript interfaces and types
4. Document new environment variables
5. Add examples if applicable

## Common Issues

### Environment Variables

Ensure all required variables are in `.env`:
```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
VITE_SPORTSDATA_API_KEY=your_key
```

### Build Errors

If you encounter build errors:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Type Errors

Always run typecheck before committing:
```bash
npm run typecheck
```

## Questions?

- Open a discussion on GitHub
- Check existing issues and PRs
- Review the documentation in `/docs`

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to Fantasy Draft Pros!
